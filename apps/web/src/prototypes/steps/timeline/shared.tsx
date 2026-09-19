import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Video01Icon, MusicNote01Icon, TextIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { CLIPS, TRACKS, PROJECT_DURATION, PROJECTS, timecode, type Clip, type Track, type TrackKind } from "#/prototypes/mock";

export * from "./leaves";
export * from "./frame";

export const DUR = PROJECT_DURATION;
export const FPS = 30;
export const MIN_PPS = 3;
export const MAX_PPS = 600;
export const PROJECT = PROJECTS[0];

/* ------------------------------------------------------------------ */
/* Playhead store — the only thing that changes 60×/s. Subscribers write */
/* straight to the DOM so no clip re-renders during playback.           */
/* ------------------------------------------------------------------ */

export class TimeStore {
  private t = 0;
  private ls = new Set<(t: number) => void>();
  get() {
    return this.t;
  }
  set(t: number) {
    this.t = Math.min(DUR, Math.max(0, t));
    for (const l of this.ls) l(this.t);
  }
  subscribe(l: (t: number) => void) {
    this.ls.add(l);
    l(this.t);
    return () => {
      this.ls.delete(l);
    };
  }
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function shortTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function tcFrames(t: number) {
  return timecode(t, FPS).slice(3).replace(".", ":");
}

/** Deterministic PRNG for fake waveforms/meters. */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const KIND_ICON: Record<TrackKind, typeof Video01Icon> = {
  video: Video01Icon,
  audio: MusicNote01Icon,
  text: TextIcon,
  effect: SparklesIcon,
};

export function KindIcon({ kind, size = 14 }: { kind: TrackKind; size?: number }) {
  return <HugeiconsIcon icon={KIND_ICON[kind]} size={size} strokeWidth={1.5} />;
}

/* ------------------------------------------------------------------ */
/* Ruler tick spacing                                                  */
/* ------------------------------------------------------------------ */

export function tickSpec(pps: number, minMajorPx = 72): { major: number; minor: number } {
  const majors: [number, number][] = [
    [0.5, 0.1],
    [1, 0.2],
    [2, 0.5],
    [5, 1],
    [10, 2],
    [15, 5],
    [30, 10],
    [60, 15],
  ];
  const hit = majors.find(([m]) => m * pps >= minMajorPx) ?? majors[majors.length - 1];
  return { major: hit[0], minor: hit[1] };
}

export function range(step: number, end = DUR): number[] {
  const out: number[] = [];
  for (let t = 0; t <= end + 1e-6; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export interface TimelineOpts {
  headerW: number;
  initialPps?: number;
  /** Track id whose clips stay gapless (CapCut model). */
  magnetic?: string;
}

export interface Engine {
  store: TimeStore;
  clips: Clip[];
  tracks: Track[];
  selected: Set<string>;
  pps: number;
  playing: boolean;
  rate: number;
  snapOn: boolean;
  snapLine: number | null;
  dragId: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  contentW: number;
  markers: number[];
  setSnapOn: (v: boolean) => void;
  seek: (t: number) => void;
  togglePlay: () => void;
  zoomBy: (factor: number) => void;
  setZoom: (pps: number) => void;
  fit: () => void;
  toggleTrack: (id: string, key: "muted" | "locked" | "hidden") => void;
  clearSelection: () => void;
  deleteSelection: () => void;
  addMarker: () => void;
  onClipPointerDown: (e: ReactPointerEvent, clip: Clip) => void;
  onScrubPointerDown: (e: ReactPointerEvent) => void;
}

function reflowPrimary(clips: Clip[], primary: string, dragId: string | null, ghostStart: number | null): Clip[] {
  const prim = clips.filter((c) => c.trackId === primary);
  const others = prim.filter((c) => c.id !== dragId).sort((a, b) => a.start - b.start);
  const dragged = prim.find((c) => c.id === dragId);
  let seq = others;
  if (dragged && ghostStart !== null) {
    const center = ghostStart + dragged.duration / 2;
    let acc = 0;
    let idx = 0;
    for (const o of others) {
      if (acc + o.duration / 2 < center) idx++;
      acc += o.duration;
    }
    seq = [...others.slice(0, idx), dragged, ...others.slice(idx)];
  }
  const starts = new Map<string, number>();
  let acc = 0;
  for (const c of seq) {
    starts.set(c.id, acc);
    acc += c.duration;
  }
  return clips.map((c) => (starts.has(c.id) ? { ...c, start: starts.get(c.id)! } : c));
}

export function useTimeline(opts: TimelineOpts): Engine {
  const { headerW, magnetic } = opts;
  const store = useMemo(() => new TimeStore(), []);
  const [clips, setClips] = useState<Clip[]>(() => (magnetic ? reflowPrimary(CLIPS, magnetic, null, null) : CLIPS));
  const [tracks, setTracks] = useState<Track[]>(TRACKS);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pps, setPps] = useState(opts.initialPps ?? 12);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [snapOn, setSnapOn] = useState(true);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [markers, setMarkers] = useState<number[]>([8.5, 34, 71.2]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const ppsRef = useRef(pps);
  ppsRef.current = pps;
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const snapRef = useRef(snapOn);
  snapRef.current = snapOn;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const xToTime = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return clamp((clientX - rect.left - headerW + el.scrollLeft) / ppsRef.current, 0, DUR);
    },
    [headerW],
  );

  const seek = useCallback((t: number) => store.set(t), [store]);

  const setZoom = useCallback((next: number) => setPps(clamp(next, MIN_PPS, MAX_PPS)), []);

  const zoomAround = useCallback((factor: number, viewportX: number) => {
    const el = scrollRef.current;
    const cur = ppsRef.current;
    const next = clamp(cur * factor, MIN_PPS, MAX_PPS);
    if (next === cur) return;
    const t = el ? (viewportX + el.scrollLeft) / cur : 0;
    setPps(next);
    requestAnimationFrame(() => {
      if (el) el.scrollLeft = t * next - viewportX;
    });
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const el = scrollRef.current;
      const view = el ? el.clientWidth - headerW : 600;
      zoomAround(factor, view / 2);
    },
    [headerW, zoomAround],
  );

  const fit = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setPps(clamp((el.clientWidth - headerW - 24) / DUR, MIN_PPS, MAX_PPS));
    el.scrollLeft = 0;
  }, [headerW]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) {
      setPlaying(false);
      setRate(1);
      return;
    }
    if (store.get() >= DUR - 1e-3) store.set(0);
    setRate(1);
    setPlaying(true);
  }, [store]);

  /* rAF clock — writes only to the store. */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const nt = store.get() + dt * rateRef.current;
      if (nt >= DUR || nt <= 0) {
        store.set(clamp(nt, 0, DUR));
        setPlaying(false);
        setRate(1);
        return;
      }
      store.set(nt);
      const el = scrollRef.current;
      if (el) {
        const x = nt * ppsRef.current - el.scrollLeft;
        const view = el.clientWidth - headerW;
        if (x > view - 24) el.scrollLeft = nt * ppsRef.current - 24;
        else if (x < 0) el.scrollLeft = Math.max(0, nt * ppsRef.current - view + 24);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, store, headerW]);

  /* Wheel: Cmd/Ctrl zooms around cursor, Shift pans, trackpad pans natively. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        zoomAround(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left - headerW);
      } else if (e.shiftKey && e.deltaX === 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [headerW, zoomAround]);

  const toggleTrack = useCallback((id: string, key: "muted" | "locked" | "hidden") => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: !t[key] } : t)));
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const deleteSelection = useCallback(() => {
    const sel = selectedRef.current;
    if (sel.size === 0) return;
    setClips((prev) => {
      const next = prev.filter((c) => !sel.has(c.id));
      return magnetic ? reflowPrimary(next, magnetic, null, null) : next;
    });
    setSelected(new Set());
  }, [magnetic]);

  const addMarker = useCallback(() => {
    const t = Math.round(store.get() * 100) / 100;
    setMarkers((m) => (m.includes(t) ? m : [...m, t].sort((a, b) => a - b)));
  }, [store]);

  /* Keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      const k = e.key;
      if (k === " ") {
        e.preventDefault();
        togglePlay();
      } else if (k === "=" || k === "+") zoomBy(1.25);
      else if (k === "-" || k === "_") zoomBy(0.8);
      else if (k === "Home") store.set(0);
      else if (k === "End") store.set(DUR);
      else if (k === "," || k === "<") store.set(store.get() - (e.shiftKey ? 1 : 1 / FPS));
      else if (k === "." || k === ">") store.set(store.get() + (e.shiftKey ? 1 : 1 / FPS)); else if (k === "Backspace" || k === "Delete") deleteSelection();
      else if (k === "n" || k === "N") setSnapOn((s) => !s);
      else if (k === "Escape") setSelected(new Set());
      else if (k === "b" || k === "B") addMarker();
      else if (k === "Z" && e.shiftKey) fit();
      else if (k === "k" || k === "K") {
        setPlaying(false);
        setRate(1);
      } else if (k === "l" || k === "L") {
        setRate((r) => (playingRef.current && r > 0 ? Math.min(8, r * 2) : 1));
        if (store.get() >= DUR - 1e-3) store.set(0);
        setPlaying(true);
      } else if (k === "j" || k === "J") {
        setRate((r) => (playingRef.current && r < 0 ? Math.max(-8, r * 2) : -1));
        setPlaying(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, zoomBy, store, deleteSelection, fit, addMarker]);

  /* Scrub (ruler / playhead flag) */
  const onScrubPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setPlaying(false);
      store.set(xToTime(e.clientX));
      const move = (ev: PointerEvent) => store.set(xToTime(ev.clientX));
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [store, xToTime],
  );

  /* Clip drag with snapping */
  const onClipPointerDown = useCallback(
    (e: ReactPointerEvent, clip: Clip) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const track = tracks.find((t) => t.id === clip.trackId);
      const shift = e.shiftKey;
      setSelected((prev) => {
        if (shift) {
          const n = new Set(prev);
          if (n.has(clip.id)) n.delete(clip.id);
          else n.add(clip.id);
          return n;
        }
        return prev.has(clip.id) && prev.size === 1 ? prev : new Set([clip.id]);
      });
      if (track?.locked) return;
      const startX = e.clientX;
      const orig = clip.start;
      let moved = false;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        if (!moved && Math.abs(dx) < 3) return;
        if (!moved) {
          moved = true;
          setDragId(clip.id);
        }
        let ns = Math.max(0, orig + dx / ppsRef.current);
        let line: number | null = null;
        if (snapRef.current) {
          const thr = 8 / ppsRef.current;
          const isPrimary = magnetic !== undefined && clip.trackId === magnetic;
          const targets = [0, store.get(), DUR];
          for (const c of clipsRef.current) {
            if (c.id === clip.id) continue;
            if (isPrimary && c.trackId === magnetic) continue;
            targets.push(c.start, c.start + c.duration);
          }
          let best = thr;
          for (const tg of targets) {
            const dS = tg - ns;
            if (Math.abs(dS) < Math.abs(best)) {
              best = dS;
              line = tg;
            }
            const dE = tg - (ns + clip.duration);
            if (Math.abs(dE) < Math.abs(best)) {
              best = dE;
              line = tg;
            }
          }
          if (line !== null) ns = Math.max(0, ns + best);
        }
        setSnapLine(line);
        if (magnetic && clip.trackId === magnetic) {
          setClips((prev) => reflowPrimary(prev, magnetic, clip.id, ns).map((c) => (c.id === clip.id ? { ...c, start: ns } : c)));
        } else {
          setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, start: ns } : c)));
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (moved && magnetic && clip.trackId === magnetic) {
          setClips((prev) => reflowPrimary(prev, magnetic, null, null));
        }
        setDragId(null);
        setSnapLine(null);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [tracks, store, magnetic],
  );

  return {
    store,
    clips,
    tracks,
    selected,
    pps,
    playing,
    rate,
    snapOn,
    snapLine,
    dragId,
    scrollRef,
    contentW: Math.ceil(DUR * pps) + 160,
    markers,
    setSnapOn,
    seek,
    togglePlay,
    zoomBy,
    setZoom,
    fit,
    toggleTrack,
    clearSelection,
    deleteSelection,
    addMarker,
    onClipPointerDown,
    onScrubPointerDown,
  };
}

