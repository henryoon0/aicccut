/**
 * The app store. No external state library: a plain object with
 * `getState/setState/subscribe`, a history stack for the document, and
 * `useEditor(selector)` on top of useSyncExternalStore.
 *
 * Document edits go through `store.mutateDoc(fn, { preview })`:
 *  - normal call → history entry pushed, redo stack cleared
 *  - `preview: true` → document replaced, no history; the first preview of a
 *    session remembers the pre-drag document, and `commit()` pushes it.
 * Selection, ripple, snapping, zoom and UI flags never touch history.
 */
import { createElement, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createActions, type Actions } from "./actions";
import { EditorContext, useEditorContext } from "./context";
import { documentDuration } from "./document";
import { TimeStore } from "./time-store";
import { createTransport, type Transport } from "./transport";
import type { Document, Selection } from "./types";

export const HISTORY_LIMIT = 100;
export const DEFAULT_ZOOM_PPS = 20;
export const MIN_ZOOM_PPS = 3;
export const MAX_ZOOM_PPS = 600;

export type EditorDialog = "import" | "export" | "new-project" | "effects" | null;
/** Left-rail tool whose flyout is shown when `mediaPanel` is open. */
export type RailTool = "media" | "text" | "effects" | "audio";

export interface UiState {
  /** Left flyout open (the rail itself is always visible). */
  mediaPanel: boolean;
  /** Which rail tool the flyout shows. */
  rail: RailTool;
  inspector: boolean;
  palette: boolean;
  cheatsheet: boolean;
  safeAreas: boolean;
  grid: boolean;
  /** Preview zoom; "fit" or a percentage. */
  previewZoom: number | "fit";
  dialog: EditorDialog;
  /** Width of the timeline viewport in px, reported by the timeline for "fit". */
  timelineWidth: number;
}

export interface EditorState {
  doc: Document;
  history: { past: Document[]; future: Document[] };
  selection: Selection;
  ripple: boolean;
  snapping: boolean;
  /** Timeline zoom in pixels per second. */
  zoomPps: number;
  uiPanels: UiState;
}

export interface MutateOpts {
  /** Replace the document without pushing history (drag previews). */
  preview?: boolean;
}

export interface EditorStore {
  getState(): EditorState;
  /** Shallow-merge a patch (or a function producing one). */
  setState(patch: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)): void;
  subscribe(fn: (s: EditorState) => void): () => void;
  /** Apply a pure document function; see module doc for history rules. Returns the new document. */
  mutateDoc(fn: (doc: Document) => Document, opts?: MutateOpts): Document;
  /** End a preview session: push the pre-preview snapshot to history. */
  commit(): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Replace the document and clear history (loading a project). */
  replaceDoc(doc: Document): void;
  actions: Actions;
}

export const DEFAULT_UI: UiState = {
  mediaPanel: true, rail: "media", inspector: true, palette: false, cheatsheet: false, safeAreas: false, grid: false,
  previewZoom: "fit", dialog: null, timelineWidth: 1200,
};

function pruneSelection(sel: Selection, doc: Document): Selection {
  const kept = sel.clipIds.filter((id) => doc.clips.some((c) => c.id === id));
  return kept.length === sel.clipIds.length ? sel : { clipIds: kept };
}

/** Create a store around an initial document. */
export function createEditorStore(initialDoc: Document, initial?: Partial<Omit<EditorState, "doc" | "history">>): EditorStore {
  let state: EditorState = {
    doc: initialDoc,
    history: { past: [], future: [] },
    selection: { clipIds: [] },
    ripple: false,
    snapping: true,
    zoomPps: DEFAULT_ZOOM_PPS,
    uiPanels: DEFAULT_UI,
    ...initial,
  };
  const listeners = new Set<(s: EditorState) => void>();
  let previewBase: Document | null = null;

  const emit = () => {
    for (const l of listeners) l(state);
  };
  const setState: EditorStore["setState"] = (patch) => {
    const p = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...p };
    if (p.doc) state.selection = pruneSelection(state.selection, state.doc);
    emit();
  };
  const push = (snapshot: Document) => ({ past: [...state.history.past, snapshot].slice(-HISTORY_LIMIT), future: [] });

  const commit = () => {
    if (!previewBase) return;
    const base = previewBase;
    previewBase = null;
    if (base !== state.doc) setState({ history: push(base) });
  };

  const mutateDoc: EditorStore["mutateDoc"] = (fn, opts) => {
    if (opts?.preview) {
      previewBase ??= state.doc;
      const next = fn(state.doc);
      if (next !== state.doc) setState({ doc: next });
      return next;
    }
    commit();
    const next = fn(state.doc);
    if (next === state.doc) return next;
    setState({ doc: next, history: push(state.doc) });
    return next;
  };

  const store: EditorStore = {
    getState: () => state,
    setState,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    mutateDoc,
    commit,
    undo() {
      commit();
      const prev = state.history.past[state.history.past.length - 1];
      if (!prev) return;
      setState({ doc: prev, history: { past: state.history.past.slice(0, -1), future: [state.doc, ...state.history.future] } });
    },
    redo() {
      commit();
      const [next, ...rest] = state.history.future;
      if (!next) return;
      setState({ doc: next, history: { past: [...state.history.past, state.doc].slice(-HISTORY_LIMIT), future: rest } });
    },
    canUndo: () => state.history.past.length > 0 || previewBase !== null,
    canRedo: () => state.history.future.length > 0,
    replaceDoc(doc) {
      previewBase = null;
      setState({ doc, history: { past: [], future: [] }, selection: { clipIds: [] } });
    },
    actions: undefined as unknown as Actions,
  };
  store.actions = createActions(store);
  return store;
}

// ── React bindings ─────────────────────────────────────────

/** Select a slice of editor state; re-renders only when the selected value changes (Object.is). */
export function useEditor<T>(selector: (s: EditorState) => T): T {
  const { store } = useEditorContext();
  const ref = useRef(selector);
  ref.current = selector;
  return useSyncExternalStore(
    store.subscribe,
    () => ref.current(store.getState()),
    () => ref.current(store.getState()),
  );
}

/** The store instance (for imperative reads in event handlers). */
export function useEditorStore(): EditorStore {
  return useEditorContext().store;
}

/** The actions object; stable for the store's lifetime. */
export function useActions(): Actions {
  return useEditorContext().store.actions;
}

/** Current selection (array identity is stable until it changes). */
export function useSelection(): Selection {
  return useEditor((s) => s.selection);
}

export interface EditorProviderProps {
  store: EditorStore;
  /** Optional externally created time store / transport (defaults are created per store). */
  time?: TimeStore;
  transport?: Transport;
  children?: ReactNode;
}

/** Provides store, time store and transport to the tree. Create the store once (useState/useMemo) in the caller. */
export function EditorProvider({ store, time, transport, children }: EditorProviderProps) {
  const value = useMemo(() => {
    const t = time ?? new TimeStore(0);
    const tr = transport ?? createTransport(t, () => documentDuration(store.getState().doc), () => store.getState().doc.project.fps);
    return { store, time: t, transport: tr };
  }, [store, time, transport]);
  return createElement(EditorContext.Provider, { value }, children);
}
