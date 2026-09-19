/**
 * Editing model shared by every clip-editing variant. Pure functions operate on
 * clip arrays; `useEditor` wraps them with a history stack so undo really
 * restores. Nothing here touches the DOM.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ASSETS, CLIPS, PROJECT_DURATION, TRACKS, type Clip, type Track } from "#/prototypes/mock";

export const FPS = 30;
export const FRAME = 1 / FPS;
/** Shortest clip we allow, in seconds (2 frames). */
export const MIN_DUR = 2 * FRAME;
const EPS = 1e-6;

export interface EClip extends Clip {
  muted?: boolean;
}
export type Edge = "start" | "end";

export const snap = (t: number) => Math.round(t * FPS) / FPS;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const endOf = (c: Clip) => c.start + c.duration;
export const trackOf = (c: Clip): Track => TRACKS.find((t) => t.id === c.trackId) ?? TRACKS[0];

/** Source length in seconds; Infinity for images, text and effects. */
export function sourceDuration(c: Clip): number {
  const a = c.assetId ? ASSETS.find((x) => x.id === c.assetId) : undefined;
  return a && a.duration > 0 ? a.duration : Infinity;
}
export const canSlip = (c: Clip) => Number.isFinite(sourceDuration(c));

export function trackClips(clips: EClip[], trackId: string): EClip[] {
  return clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
}

export function neighbors(clips: EClip[], c: EClip): { prev?: EClip; next?: EClip } {
  const lane = trackClips(clips, c.trackId);
  const i = lane.findIndex((x) => x.id === c.id);
  return { prev: lane[i - 1], next: lane[i + 1] };
}

let seq = 100;
const newId = () => `c${++seq}`;

function shiftTrackAfter(clips: EClip[], trackId: string, from: number, delta: number, exceptId?: string): EClip[] {
  if (Math.abs(delta) < EPS) return clips;
  return clips.map((x) =>
    x.trackId === trackId && x.id !== exceptId && x.start >= from - EPS ? { ...x, start: snap(x.start + delta) } : x,
  );
}

/** Trim one edge by `delta` seconds. Respects inPoint ≥ 0, the source length and neighbours; ripple closes the gap. */
export function applyTrim(clips: EClip[], id: string, edge: Edge, delta: number, ripple: boolean): EClip[] {
  const c = clips.find((x) => x.id === id);
  if (!c || Math.abs(delta) < EPS) return clips;
  const { prev, next } = neighbors(clips, c);
  const src = sourceDuration(c);
  if (edge === "start") {
    const minStart = Math.max(c.start - c.inPoint, ripple ? -Infinity : prev ? endOf(prev) : 0, ripple ? -Infinity : 0);
    const ns = clamp(snap(c.start + delta), minStart, endOf(c) - MIN_DUR);
    const d = ns - c.start;
    if (Math.abs(d) < EPS) return clips;
    const updated: EClip = { ...c, start: ripple ? c.start : ns, inPoint: snap(c.inPoint + d), duration: snap(c.duration - d) };
    const out = clips.map((x) => (x.id === id ? updated : x));
    return ripple ? shiftTrackAfter(out, c.trackId, endOf(c), -d, id) : out;
  }
  const maxDur = Math.min(src - c.inPoint, ripple || !next ? Infinity : next.start - c.start);
  const nd = clamp(snap(c.duration + delta), MIN_DUR, maxDur);
  const d = nd - c.duration;
  if (Math.abs(d) < EPS) return clips;
  const out = clips.map((x) => (x.id === id ? { ...x, duration: nd } : x));
  return ripple ? shiftTrackAfter(out, c.trackId, endOf(c), d, id) : out;
}

/** Slide the source window without moving the clip. */
export function applySlip(clips: EClip[], id: string, delta: number): EClip[] {
  const c = clips.find((x) => x.id === id);
  if (!c || !canSlip(c)) return clips;
  const ni = clamp(snap(c.inPoint + delta), 0, sourceDuration(c) - c.duration);
  if (Math.abs(ni - c.inPoint) < EPS) return clips;
  return clips.map((x) => (x.id === id ? { ...x, inPoint: ni } : x));
}

/** Move the cut between two adjacent clips; total length stays the same. */
export function applyRoll(clips: EClip[], leftId: string, rightId: string, delta: number): EClip[] {
  const l = clips.find((x) => x.id === leftId);
  const r = clips.find((x) => x.id === rightId);
  if (!l || !r) return clips;
  const lo = Math.max(MIN_DUR - l.duration, -r.inPoint);
  const hi = Math.min(sourceDuration(l) - l.inPoint - l.duration, r.duration - MIN_DUR);
  const d = clamp(snap(delta), lo, hi);
  if (Math.abs(d) < EPS) return clips;
  return clips.map((x) => {
    if (x.id === leftId) return { ...x, duration: snap(x.duration + d) };
    if (x.id === rightId) return { ...x, start: snap(x.start + d), inPoint: snap(x.inPoint + d), duration: snap(x.duration - d) };
    return x;
  });
}

/** Split every listed clip that crosses `t`. Returns the ids of the right-hand halves. */
export function applySplit(clips: EClip[], ids: string[], t: number): { clips: EClip[]; rightIds: string[] } {
  const rightIds: string[] = [];
  const out: EClip[] = [];
  for (const c of clips) {
    if (ids.includes(c.id) && t > c.start + MIN_DUR - EPS && t < endOf(c) - MIN_DUR + EPS) {
      const cut = snap(t);
      const right: EClip = { ...c, id: newId(), start: cut, duration: snap(endOf(c) - cut), inPoint: snap(c.inPoint + (cut - c.start)) };
      out.push({ ...c, duration: snap(cut - c.start) }, right);
      rightIds.push(right.id);
    } else out.push(c);
  }
  return rightIds.length ? { clips: out, rightIds } : { clips, rightIds };
}

export function applyDelete(clips: EClip[], ids: string[], ripple: boolean): EClip[] {
  let cur = clips;
  const order = [...ids].sort((a, b) => (cur.find((x) => x.id === a)?.start ?? 0) - (cur.find((x) => x.id === b)?.start ?? 0));
  for (const id of order) {
    const c = cur.find((x) => x.id === id);
    if (!c) continue;
    cur = cur.filter((x) => x.id !== id);
    if (ripple) cur = shiftTrackAfter(cur, c.trackId, endOf(c), -c.duration);
  }
  return cur;
}

export function applyDuplicate(clips: EClip[], id: string): { clips: EClip[]; newId?: string } {
  const c = clips.find((x) => x.id === id);
  if (!c) return { clips };
  const copy: EClip = { ...c, id: newId(), start: endOf(c) };
  const shifted = shiftTrackAfter(clips, c.trackId, endOf(c), c.duration, id);
  return { clips: [...shifted, copy], newId: copy.id };
}

export function applyToggleMute(clips: EClip[], ids: string[]): EClip[] {
  return clips.map((x) => (ids.includes(x.id) ? { ...x, muted: !x.muted } : x));
}

export function clipsAt(clips: EClip[], t: number): EClip[] {
  return clips.filter((c) => t >= c.start - EPS && t < endOf(c) - EPS);
}

export function sameClips(a: EClip[], b: EClip[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return x.id === y.id && x.start === y.start && x.duration === y.duration && x.inPoint === y.inPoint && x.muted === y.muted;
  });
}

// ── history reducer ───────────────────────────────────────

interface Doc {
  clips: EClip[];
  past: EClip[][];
  future: EClip[][];
}
type Act =
  | { type: "apply"; fn: (clips: EClip[]) => EClip[] }
  | { type: "preview"; clips: EClip[] }
  | { type: "commit"; snapshot: EClip[] }
  | { type: "undo" }
  | { type: "redo" };

function reducer(s: Doc, a: Act): Doc {
  switch (a.type) {
    case "apply": {
      const next = a.fn(s.clips);
      if (next === s.clips || sameClips(next, s.clips)) return s;
      return { clips: next, past: [...s.past, s.clips].slice(-60), future: [] };
    }
    case "preview":
      return { ...s, clips: a.clips };
    case "commit":
      if (sameClips(a.snapshot, s.clips)) return { ...s, clips: a.snapshot };
      return { ...s, past: [...s.past, a.snapshot].slice(-60), future: [] };
    case "undo": {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return { clips: prev, past: s.past.slice(0, -1), future: [s.clips, ...s.future] };
    }
    case "redo": {
      const [next, ...rest] = s.future;
      if (!next) return s;
      return { clips: next, past: [...s.past, s.clips], future: rest };
    }
  }
}

export interface EditorApi {
  clips: EClip[];
  selection: string[];
  selected: EClip[];
  primary: EClip | null;
  playhead: number;
  ripple: boolean;
  playing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  setPlayhead: (t: number) => void;
  togglePlay: () => void;
  select: (id: string, additive?: boolean) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  toggleRipple: () => void;
  setRipple: (on: boolean) => void;
  undo: () => void;
  redo: () => void;
  /** Mutate with a pure function; pushes history when anything changed. */
  apply: (fn: (clips: EClip[]) => EClip[]) => void;
  /** Show an in-progress edit without touching history. */
  preview: (clips: EClip[]) => void;
  /** End an in-progress edit; `snapshot` is what undo will restore. */
  commit: (snapshot: EClip[]) => void;
  split: (ids?: string[], at?: number) => void;
  remove: (ids?: string[], rippleOverride?: boolean) => void;
  duplicate: (id?: string) => void;
  toggleMute: (ids?: string[]) => void;
  trimToPlayhead: (edge: Edge, id?: string) => void;
  nudge: (id: string, edge: Edge, frames: number) => void;
}

export function useEditor(initialPlayhead = 18.5): EditorApi {
  const [doc, dispatch] = useReducer(reducer, { clips: CLIPS as EClip[], past: [], future: [] });
  const [selection, setSelectionRaw] = useState<string[]>([]);
  const [playhead, setPlayheadRaw] = useState(initialPlayhead);
  const [ripple, setRipple] = useState(false);
  const [playing, setPlaying] = useState(false);

  const clips = doc.clips;
  const selected = useMemo(() => selection.map((id) => clips.find((c) => c.id === id)).filter((c): c is EClip => !!c), [clips, selection]);
  const primary = selected[selected.length - 1] ?? null;

  const setPlayhead = useCallback((t: number) => setPlayheadRaw(clamp(snap(t), 0, PROJECT_DURATION)), []);
  const playRef = useRef(playing);
  playRef.current = playing;
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPlayheadRaw((p) => {
        const n = p + dt;
        if (n >= PROJECT_DURATION) {
          setPlaying(false);
          return PROJECT_DURATION;
        }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const select = useCallback((id: string, additive = false) => {
    setSelectionRaw((s) => (additive ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));
  }, []);
  const setSelection = useCallback((ids: string[]) => setSelectionRaw(ids), []);
  const clearSelection = useCallback(() => setSelectionRaw([]), []);

  const apply = useCallback((fn: (c: EClip[]) => EClip[]) => dispatch({ type: "apply", fn }), []);
  const preview = useCallback((c: EClip[]) => dispatch({ type: "preview", clips: c }), []);
  const commit = useCallback((snapshot: EClip[]) => dispatch({ type: "commit", snapshot }), []);

  const split = useCallback(
    (ids?: string[], at?: number) => {
      const t = at ?? playhead;
      const targets = ids ?? (selection.length ? selection : clipsAt(clips, t).map((c) => c.id));
      const res = applySplit(clips, targets, t);
      if (!res.rightIds.length) return;
      dispatch({ type: "apply", fn: () => res.clips });
      setSelectionRaw(res.rightIds);
    },
    [clips, playhead, selection],
  );

  const remove = useCallback(
    (ids?: string[], rippleOverride?: boolean) => {
      const targets = ids ?? selection;
      if (!targets.length) return;
      dispatch({ type: "apply", fn: (cur) => applyDelete(cur, targets, rippleOverride ?? ripple) });
      setSelectionRaw((s) => s.filter((x) => !targets.includes(x)));
    },
    [selection, ripple],
  );

  const duplicate = useCallback(
    (id?: string) => {
      const target = id ?? primary?.id;
      if (!target) return;
      const res = applyDuplicate(clips, target);
      if (!res.newId) return;
      dispatch({ type: "apply", fn: () => res.clips });
      setSelectionRaw([res.newId]);
    },
    [clips, primary],
  );

  const toggleMute = useCallback(
    (ids?: string[]) => {
      const targets = ids ?? selection;
      if (targets.length) dispatch({ type: "apply", fn: (cur) => applyToggleMute(cur, targets) });
    },
    [selection],
  );

  const trimToPlayhead = useCallback(
    (edge: Edge, id?: string) => {
      const target = id ?? primary?.id;
      if (!target) return;
      dispatch({
        type: "apply",
        fn: (cur) => {
          const c = cur.find((x) => x.id === target);
          if (!c || playhead <= c.start || playhead >= endOf(c)) return cur;
          return applyTrim(cur, target, edge, edge === "start" ? playhead - c.start : playhead - endOf(c), ripple);
        },
      });
    },
    [primary, playhead, ripple],
  );

  const nudge = useCallback(
    (id: string, edge: Edge, frames: number) => dispatch({ type: "apply", fn: (cur) => applyTrim(cur, id, edge, frames * FRAME, ripple) }),
    [ripple],
  );

  // Drop selection entries whose clip vanished (undo, delete).
  useEffect(() => {
    setSelectionRaw((s) => {
      const kept = s.filter((id) => clips.some((c) => c.id === id));
      return kept.length === s.length ? s : kept;
    });
  }, [clips]);

  return {
    clips,
    selection,
    selected,
    primary,
    playhead,
    ripple,
    playing,
    canUndo: doc.past.length > 0,
    canRedo: doc.future.length > 0,
    setPlayhead,
    togglePlay: () => setPlaying((p) => !p),
    select,
    setSelection,
    clearSelection,
    toggleRipple: () => setRipple((r) => !r),
    setRipple,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    apply,
    preview,
    commit,
    split,
    remove,
    duplicate,
    toggleMute,
    trimToPlayhead,
    nudge,
  };
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
}

/**
 * Standard editing keys. `extra` runs first and may return true to claim the
 * key (variants add tool modes, [ ] trims, etc.).
 */
export function useEditorKeys(ed: EditorApi, extra?: (e: KeyboardEvent) => boolean) {
  const edRef = useRef(ed);
  edRef.current = ed;
  const extraRef = useRef(extra);
  extraRef.current = extra;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const ed = edRef.current;
      if (extraRef.current?.(e)) {
        e.preventDefault();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
      } else if (mod && k === "d") {
        e.preventDefault();
        ed.duplicate();
      } else if (!mod && k === "s") ed.split();
      else if (!mod && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        ed.remove(undefined, e.shiftKey ? true : undefined);
      } else if (!mod && k === "r") ed.toggleRipple();
      else if (!mod && k === "m") ed.toggleMute();
      else if (e.key === "Escape") ed.clearSelection();
      else if (e.key === " ") {
        e.preventDefault();
        ed.togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) * FRAME * (e.key === "ArrowLeft" ? -1 : 1);
        ed.setPlayhead(ed.playhead + step);
      } else if (e.key === "Home") ed.setPlayhead(0);
      else if (e.key === "End") ed.setPlayhead(PROJECT_DURATION);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export const fmtDelta = (d: number, digits = 1) => `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(digits)} s`;
export const fmtSec = (t: number, digits = 1) => `${t.toFixed(digits)} s`;
export const toFrames = (t: number) => Math.round(t * FPS);
