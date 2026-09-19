/**
 * Keyframe engine shared by every variant of this step: channel metadata,
 * easing curves, interpolation, and the two hooks (store + transport) that
 * make the preview move. UI lives in ./shared.tsx.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CLIPS, PROJECT_DURATION, type Clip } from "#/prototypes/mock";

// ── Channels ───────────────────────────────────────────────

export type Channel =
  | "x"
  | "y"
  | "scale"
  | "opacity"
  | "blur"
  | "brightness"
  | "contrast"
  | "saturation";

export interface ChannelMeta {
  key: Channel;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Rest value when a channel has no keyframes. */
  base: number;
  /** Line colour in graph / lane UIs. */
  color: string;
  group: "transform" | "effect";
}

export const CHANNELS: Record<Channel, ChannelMeta> = {
  x: { key: "x", label: "Position X", unit: "px", min: -960, max: 960, step: 1, base: 0, color: "#ff6b6b", group: "transform" },
  y: { key: "y", label: "Position Y", unit: "px", min: -540, max: 540, step: 1, base: 0, color: "#f4a261", group: "transform" },
  scale: { key: "scale", label: "Scale", unit: "%", min: 0, max: 300, step: 1, base: 100, color: "#2ec4b6", group: "transform" },
  opacity: { key: "opacity", label: "Opacity", unit: "%", min: 0, max: 100, step: 1, base: 100, color: "#5b6cff", group: "transform" },
  blur: { key: "blur", label: "Blur", unit: "px", min: 0, max: 64, step: 0.5, base: 0, color: "#c77dff", group: "effect" },
  brightness: { key: "brightness", label: "Brightness", unit: "", min: -100, max: 100, step: 1, base: 0, color: "#ffd166", group: "effect" },
  contrast: { key: "contrast", label: "Contrast", unit: "%", min: 0, max: 200, step: 1, base: 100, color: "#06d6a0", group: "effect" },
  saturation: { key: "saturation", label: "Saturation", unit: "%", min: 0, max: 200, step: 1, base: 100, color: "#ff006e", group: "effect" },
};

export const TRANSFORM_CHANNELS: Channel[] = ["x", "y", "scale", "opacity"];
export const ALL_CHANNELS = Object.keys(CHANNELS) as Channel[];

export function clampChannel(ch: Channel, v: number): number {
  const m = CHANNELS[ch];
  return Math.min(m.max, Math.max(m.min, v));
}

export function formatValue(ch: Channel, v: number): string {
  const m = CHANNELS[ch];
  const n = m.step < 1 ? v.toFixed(1) : Math.round(v).toString();
  if (ch === "brightness") return (v > 0 ? "+" : "") + n;
  return `${n}${m.unit}`;
}

// ── Easing ─────────────────────────────────────────────────

export type EasingPreset = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "spring";
/** A preset name, or explicit cubic-bezier control points [x1, y1, x2, y2]. */
export type Easing = EasingPreset | [number, number, number, number];

export const EASING_PRESETS: { value: EasingPreset; label: string; bezier: [number, number, number, number] }[] = [
  { value: "linear", label: "Linear", bezier: [0.33, 0.33, 0.67, 0.67] },
  { value: "ease-in", label: "Ease in", bezier: [0.42, 0, 1, 1] },
  { value: "ease-out", label: "Ease out", bezier: [0, 0, 0.58, 1] },
  { value: "ease-in-out", label: "Ease in-out", bezier: [0.42, 0, 0.58, 1] },
  { value: "spring", label: "Spring", bezier: [0.34, 1.56, 0.64, 1] },
];

export function easingLabel(e: Easing): string {
  if (Array.isArray(e)) return "Custom";
  return EASING_PRESETS.find((p) => p.value === e)?.label ?? e;
}

export function easingToBezier(e: Easing): [number, number, number, number] {
  if (Array.isArray(e)) return e;
  return EASING_PRESETS.find((p) => p.value === e)?.bezier ?? [0.33, 0.33, 0.67, 0.67];
}

/** Solve a CSS-style cubic bezier for y at x (Newton + bisection fallback). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - x;
    if (Math.abs(err) < 1e-5) return sampleY(t);
    const d = slopeX(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0, hi = 1;
  t = x;
  while (lo < hi) {
    const err = sampleX(t) - x;
    if (Math.abs(err) < 1e-5) break;
    if (err > 0) hi = t; else lo = t;
    t = (lo + hi) / 2;
  }
  return sampleY(t);
}

/** Progress 0..1 → eased 0..1 (spring may overshoot above 1). */
export function ease(e: Easing, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (e === "linear") return p;
  if (e === "spring") {
    // Under-damped spring settling at 1 — visibly overshoots then lands.
    return 1 - Math.exp(-6 * p) * Math.cos(2 * Math.PI * 1.15 * p);
  }
  const [x1, y1, x2, y2] = easingToBezier(e);
  return cubicBezier(x1, y1, x2, y2, p);
}

// ── Keyframes ──────────────────────────────────────────────

export interface Keyframe {
  id: string;
  /** Seconds from the clip's start. */
  t: number;
  value: number;
  /** Easing of the segment leaving this keyframe. */
  easing: Easing;
}

export type KeyframeMap = Partial<Record<Channel, Keyframe[]>>;

let idCounter = 100;
export const nextId = (prefix = "k") => `${prefix}${++idCounter}`;

export function sortKfs(kfs: Keyframe[]): Keyframe[] {
  return [...kfs].sort((a, b) => a.t - b.t);
}

/** Value of a channel at clip-relative time t. */
export function interpolate(kfs: Keyframe[] | undefined, t: number, base: number): number {
  if (!kfs || kfs.length === 0) return base;
  const s = sortKfs(kfs);
  if (t <= s[0].t) return s[0].value;
  const last = s[s.length - 1];
  if (t >= last.t) return last.value;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1e-6;
      const p = ease(a.easing, (t - a.t) / span);
      return a.value + (b.value - a.value) * p;
    }
  }
  return last.value;
}

export type ChannelValues = Record<Channel, number>;

export function evaluateAll(map: KeyframeMap, t: number): ChannelValues {
  const out = {} as ChannelValues;
  for (const ch of ALL_CHANNELS) out[ch] = interpolate(map[ch], t, CHANNELS[ch].base);
  return out;
}

// ── The animated clip every variant works on ───────────────

/** slide_hooks_01 on Video 2: 30.0s → 39.0s. */
export const HERO_CLIP: Clip = CLIPS.find((c) => c.id === "c6")!;
export const HERO_BG: Clip = CLIPS.find((c) => c.id === "c2")!;

/** A "slide in from left + fade + unblur" starting state so the preview moves on first play. */
export function initialKeyframes(): KeyframeMap {
  return {
    x: [
      { id: nextId(), t: 0, value: -420, easing: "ease-out" },
      { id: nextId(), t: 0.9, value: 0, easing: "linear" },
    ],
    opacity: [
      { id: nextId(), t: 0, value: 0, easing: "ease-out" },
      { id: nextId(), t: 0.7, value: 100, easing: "linear" },
      { id: nextId(), t: 8.2, value: 100, easing: "ease-in" },
      { id: nextId(), t: 9, value: 0, easing: "linear" },
    ],
    scale: [
      { id: nextId(), t: 0, value: 88, easing: "spring" },
      { id: nextId(), t: 1.1, value: 100, easing: "linear" },
    ],
    blur: [
      { id: nextId(), t: 0, value: 18, easing: "ease-out" },
      { id: nextId(), t: 0.8, value: 0, easing: "linear" },
    ],
  };
}

// ── Store hook ─────────────────────────────────────────────

export interface KeyframeStore {
  map: KeyframeMap;
  setMap: (next: KeyframeMap | ((m: KeyframeMap) => KeyframeMap)) => void;
  isAnimated: (ch: Channel) => boolean;
  /** Add (or overwrite one within 1 frame) a keyframe at t. Returns its id. */
  addAt: (ch: Channel, t: number, value: number, easing?: Easing) => string;
  move: (ch: Channel, id: string, t: number) => void;
  setValue: (ch: Channel, id: string, value: number) => void;
  setEasing: (ch: Channel, id: string, easing: Easing) => void;
  remove: (ch: Channel, id: string) => void;
  /** Stopwatch: on → first keyframe at t with value; off → wipe channel. */
  toggleAnimated: (ch: Channel, t: number, value: number) => void;
  clearChannel: (ch: Channel) => void;
  /** Set the channel value at t: writes a keyframe when animated, else sets the static base override. */
  setAt: (ch: Channel, t: number, value: number) => void;
  /** Static (non-animated) overrides for channels without keyframes. */
  statics: Partial<Record<Channel, number>>;
  /** Evaluate all channels at clip-relative t, honouring statics. */
  evaluate: (t: number) => ChannelValues;
  /** Every keyframe in every channel, flattened and sorted by time. */
  all: { ch: Channel; kf: Keyframe }[];
}

const FRAME = 1 / 30;

export function useKeyframeStore(initial: () => KeyframeMap = initialKeyframes): KeyframeStore {
  const [map, setMap] = useState<KeyframeMap>(initial);
  const [statics, setStatics] = useState<Partial<Record<Channel, number>>>({});

  const update = useCallback((ch: Channel, fn: (kfs: Keyframe[]) => Keyframe[]) => {
    setMap((m) => ({ ...m, [ch]: fn(m[ch] ?? []) }));
  }, []);

  const addAt = useCallback<KeyframeStore["addAt"]>((ch, t, value, easing) => {
    let id = "";
    setMap((m) => {
      const kfs = m[ch] ?? [];
      const hit = kfs.find((k) => Math.abs(k.t - t) < FRAME / 2);
      if (hit) {
        id = hit.id;
        return { ...m, [ch]: kfs.map((k) => (k.id === hit.id ? { ...k, value } : k)) };
      }
      id = nextId();
      const prev = sortKfs(kfs).filter((k) => k.t < t).pop();
      return { ...m, [ch]: sortKfs([...kfs, { id, t, value, easing: easing ?? prev?.easing ?? "ease-in-out" }]) };
    });
    return id;
  }, []);

  const move = useCallback<KeyframeStore["move"]>((ch, id, t) => {
    update(ch, (kfs) => sortKfs(kfs.map((k) => (k.id === id ? { ...k, t: Math.max(0, Math.min(HERO_CLIP.duration, t)) } : k))));
  }, [update]);

  const setValue = useCallback<KeyframeStore["setValue"]>((ch, id, value) => {
    update(ch, (kfs) => kfs.map((k) => (k.id === id ? { ...k, value: clampChannel(ch, value) } : k)));
  }, [update]);

  const setEasing = useCallback<KeyframeStore["setEasing"]>((ch, id, easing) => {
    update(ch, (kfs) => kfs.map((k) => (k.id === id ? { ...k, easing } : k)));
  }, [update]);

  const remove = useCallback<KeyframeStore["remove"]>((ch, id) => {
    update(ch, (kfs) => kfs.filter((k) => k.id !== id));
  }, [update]);

  const clearChannel = useCallback((ch: Channel) => {
    setMap((m) => {
      const next = { ...m };
      delete next[ch];
      return next;
    });
  }, []);

  const toggleAnimated = useCallback<KeyframeStore["toggleAnimated"]>((ch, t, value) => {
    setMap((m) => {
      if ((m[ch]?.length ?? 0) > 0) {
        const next = { ...m };
        delete next[ch];
        return next;
      }
      return { ...m, [ch]: [{ id: nextId(), t, value, easing: "ease-in-out" as Easing }] };
    });
    setStatics((s) => ({ ...s, [ch]: value }));
  }, []);

  const isAnimated = useCallback((ch: Channel) => (map[ch]?.length ?? 0) > 0, [map]);

  const setAt = useCallback<KeyframeStore["setAt"]>((ch, t, value) => {
    const v = clampChannel(ch, value);
    if ((map[ch]?.length ?? 0) > 0) addAt(ch, t, v);
    else setStatics((s) => ({ ...s, [ch]: v }));
  }, [map, addAt]);

  const evaluate = useCallback((t: number): ChannelValues => {
    const out = {} as ChannelValues;
    for (const ch of ALL_CHANNELS) {
      const kfs = map[ch];
      out[ch] = kfs && kfs.length ? interpolate(kfs, t, CHANNELS[ch].base) : statics[ch] ?? CHANNELS[ch].base;
    }
    return out;
  }, [map, statics]);

  const all = useMemo(() => {
    const list: { ch: Channel; kf: Keyframe }[] = [];
    for (const ch of ALL_CHANNELS) for (const kf of map[ch] ?? []) list.push({ ch, kf });
    return list.sort((a, b) => a.kf.t - b.kf.t);
  }, [map]);

  return { map, setMap, isAnimated, addAt, move, setValue, setEasing, remove, toggleAnimated, clearChannel, setAt, statics, evaluate, all };
}

// ── Transport hook ─────────────────────────────────────────

export interface Transport {
  /** Absolute project time, seconds. */
  time: number;
  /** Time relative to HERO_CLIP start, clamped to its duration. */
  clipTime: number;
  playing: boolean;
  loopClip: boolean;
  setLoopClip: (v: boolean) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  seekClip: (clipT: number) => void;
  stepFrame: (dir: 1 | -1) => void;
}

export function useTransport(start = HERO_CLIP.start): Transport {
  const [time, setTime] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [loopClip, setLoopClip] = useState(true);
  const loopRef = useRef(loopClip);
  loopRef.current = loopClip;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const end = loopRef.current ? HERO_CLIP.start + HERO_CLIP.duration : PROJECT_DURATION;
        const begin = loopRef.current ? HERO_CLIP.start : 0;
        let n = t + dt;
        if (n >= end) n = begin + (n - end);
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Space toggles play unless typing in a field.
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if ((e.target as HTMLElement | null)?.closest("[data-kf]")) return;
        e.preventDefault();
        setTime((t) => Math.max(0, Math.min(PROJECT_DURATION, t + (e.key === "ArrowLeft" ? -FRAME : FRAME))));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const seek = useCallback((t: number) => setTime(Math.max(0, Math.min(PROJECT_DURATION, t))), []);
  const seekClip = useCallback((ct: number) => setTime(HERO_CLIP.start + Math.max(0, Math.min(HERO_CLIP.duration, ct))), []);
  const stepFrame = useCallback((dir: 1 | -1) => setTime((t) => Math.max(0, Math.min(PROJECT_DURATION, t + dir * FRAME))), []);

  const clipTime = Math.max(0, Math.min(HERO_CLIP.duration, time - HERO_CLIP.start));
  return {
    time,
    clipTime,
    playing,
    loopClip,
    setLoopClip,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle,
    seek,
    seekClip,
    stepFrame,
  };
}

/** Snap a clip-relative time to the 30fps grid. */
export function snapFrame(t: number): number {
  return Math.round(t / FRAME) * FRAME;
}

export function fmtClipTime(t: number): string {
  const s = Math.floor(t);
  const f = Math.round((t - s) * 30) % 30;
  return `${s}.${String(f).padStart(2, "0")}s`;
}
