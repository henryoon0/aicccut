/**
 * Shell-only hooks: theme class on <html>, the autosave status indicator,
 * and the rail number keys. Toasts belong to the commands area, which owns
 * the one sonner host; `uiPanels.timelineWidth` belongs to the timeline area,
 * which measures its lane viewport rather than the whole slot.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  isEditableTarget,
  useActions,
  useEditorStore,
  type EditorStore,
  type RailTool,
} from "#/editor/core";

/* ───────────────────────── Theme ───────────────────────── */

export type Theme = "dark" | "light";
export const THEME_KEY = "opencut.theme";

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Dark-first theme persisted in localStorage; toggles the `dark` class on <html>. */
export function useTheme(): [Theme, () => void] {
  // Render "dark" on the server and first client paint; sync from storage in an effect.
  const [theme, setTheme] = useState<Theme>("dark");
  useLayoutEffect(() => {
    setTheme(readTheme());
  }, []);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);
  return [theme, toggle];
}

/* ───────────────────────── Save status ───────────────────────── */

export type SaveStatus = "saved" | "saving";

/**
 * Watches the store's document and reports whether an autosave write is in
 * flight. The write itself belongs to `useAutosave` (run once by the route);
 * this hook only mirrors its debounce so the top bar can say "Saving…".
 */
export function useSaveStatus(store: EditorStore, delayMs = 800): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("saved");
  useEffect(() => {
    let lastDoc = store.getState().doc;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = store.subscribe((s) => {
      if (s.doc === lastDoc) return;
      lastDoc = s.doc;
      setStatus("saving");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setStatus("saved"), delayMs + 40);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [store, delayMs]);
  return status;
}

/* ───────────────────────── Rail keys ───────────────────────── */

export const RAIL_TOOLS: { id: RailTool; key: string }[] = [
  { id: "media", key: "1" },
  { id: "text", key: "2" },
  { id: "effects", key: "3" },
  { id: "audio", key: "4" },
];

/** Keys 1–4 open a rail tool; pressing the active tool's key closes the flyout. */
export function useRailKeys() {
  const store = useEditorStore();
  const actions = useActions();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return;
      const ui = store.getState().uiPanels;
      if (ui.palette || ui.dialog) return;
      const hit = RAIL_TOOLS.find((t) => t.key === e.key);
      if (!hit) return;
      e.preventDefault();
      if (ui.mediaPanel && ui.rail === hit.id) actions.setUi({ mediaPanel: false });
      else actions.setUi({ mediaPanel: true, rail: hit.id });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, actions]);
}
