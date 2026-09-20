/**
 * Easing, interpolation and per-clip evaluation. Pure; no React.
 * Copied from the keyframes prototype engine and extended with `rotation`.
 */
import type { Channel, ChannelValues, Clip, Easing, EasingPreset, Keyframe, KeyframeMap } from "./types";

export interface ChannelMeta {
  key: Channel;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Line colour in graph / lane UIs. */
  color: string;
}

export const CHANNELS: Record<Channel, ChannelMeta> = {
  x: { key: "x", label: "위치 X", unit: "px", min: -1920, max: 1920, step: 1, color: "#ff6b6b" },
  y: { key: "y", label: "위치 Y", unit: "px", min: -1920, max: 1920, step: 1, color: "#f4a261" },
  scale: { key: "scale", label: "크기", unit: "%", min: 0, max: 400, step: 1, color: "#2ec4b6" },
  rotation: { key: "rotation", label: "회전", unit: "°", min: -360, max: 360, step: 1, color: "#ffd166" },
  opacity: { key: "opacity", label: "불투명도", unit: "%", min: 0, max: 100, step: 1, color: "#5b6cff" },
  blur: { key: "blur", label: "블러", unit: "px", min: 0, max: 64, step: 0.5, color: "#c77dff" },
};

export const ALL_CHANNELS: Channel[] = ["x", "y", "scale", "rotation", "opacity", "blur"];
export const TRANSFORM_CHANNELS: Channel[] = ["x", "y", "scale", "rotation", "opacity"];

/** Clamp a value into the channel's allowed range. */
export function clampChannel(ch: Channel, v: number): number {
  const m = CHANNELS[ch];
  return Math.min(m.max, Math.max(m.min, v));
}

/** Human string for a channel value, e.g. "12.5px" or "+20". */
export function formatChannelValue(ch: Channel, v: number): string {
  const m = CHANNELS[ch];
  const n = m.step < 1 ? v.toFixed(1) : Math.round(v).toString();
  return `${n}${m.unit}`;
}

// ── Easing ─────────────────────────────────────────────────

export const EASING_PRESETS: { value: EasingPreset; label: string; bezier: [number, number, number, number] }[] = [
  { value: "linear", label: "일정하게", bezier: [0.33, 0.33, 0.67, 0.67] },
  { value: "ease-in", label: "천천히 시작", bezier: [0.42, 0, 1, 1] },
  { value: "ease-out", label: "천천히 끝", bezier: [0, 0, 0.58, 1] },
  { value: "ease-in-out", label: "천천히 시작·끝", bezier: [0.42, 0, 0.58, 1] },
  { value: "spring", label: "튕김", bezier: [0.34, 1.56, 0.64, 1] },
];

/** Display label for an easing ("Custom" for explicit beziers). */
export function easingLabel(e: Easing): string {
  if (Array.isArray(e)) return "직접 설정";
  return EASING_PRESETS.find((p) => p.value === e)?.label ?? e;
}

/** Control points for an easing; presets map to their CSS-equivalent bezier. */
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

/** Under-damped spring settling at 1; visibly overshoots then lands. */
export function spring(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - Math.exp(-6 * p) * Math.cos(2 * Math.PI * 1.15 * p);
}

/** Progress 0..1 → eased 0..1 (spring may overshoot above 1). */
export function ease(e: Easing, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (e === "linear") return p;
  if (e === "spring") return spring(p);
  const [x1, y1, x2, y2] = easingToBezier(e);
  return cubicBezier(x1, y1, x2, y2, p);
}

// ── Keyframes ──────────────────────────────────────────────

/** Copy of the keyframes ordered by time. */
export function sortKfs(kfs: Keyframe[]): Keyframe[] {
  return [...kfs].sort((a, b) => a.time - b.time);
}

/** Value of a channel at clip-relative time t; `base` when the channel has no keyframes. */
export function interpolate(kfs: Keyframe[] | undefined, t: number, base: number): number {
  if (!kfs || kfs.length === 0) return base;
  const s = sortKfs(kfs);
  if (t <= s[0].time) return s[0].value;
  const last = s[s.length - 1];
  if (t >= last.time) return last.value;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    if (t >= a.time && t <= b.time) {
      const span = b.time - a.time || 1e-6;
      const p = ease(a.easing, (t - a.time) / span);
      return a.value + (b.value - a.value) * p;
    }
  }
  return last.value;
}

/** Static (un-animated) value of every channel, read from the clip's props. */
export function baseValues(clip: Clip): ChannelValues {
  const blurFx = clip.props.effects.find((e) => e.type === "blur" && e.enabled);
  return {
    x: clip.props.x,
    y: clip.props.y,
    scale: clip.props.scale,
    rotation: clip.props.rotation,
    opacity: clip.props.opacity,
    blur: blurFx?.params.amount ?? 0,
  };
}

/** Evaluate every channel of a keyframe map at clip-relative t, falling back to `base`. */
export function evaluateMap(map: KeyframeMap, t: number, base: ChannelValues): ChannelValues {
  const out = { ...base };
  for (const ch of ALL_CHANNELS) out[ch] = interpolate(map[ch], t, base[ch]);
  return out;
}

/** Channel values of a clip at an absolute timeline time (props overridden by keyframes). */
export function evaluateClip(clip: Clip, absoluteTime: number): ChannelValues {
  const t = Math.max(0, Math.min(clip.duration, absoluteTime - clip.start));
  return evaluateMap(clip.props.keyframes, t, baseValues(clip));
}

/** Whether a channel has at least one keyframe. */
export function isAnimated(map: KeyframeMap, ch: Channel): boolean {
  return (map[ch]?.length ?? 0) > 0;
}

/** Every keyframe across channels, flattened and sorted by time. */
export function allKeyframes(map: KeyframeMap): { channel: Channel; keyframe: Keyframe }[] {
  const list: { channel: Channel; keyframe: Keyframe }[] = [];
  for (const ch of ALL_CHANNELS) for (const keyframe of map[ch] ?? []) list.push({ channel: ch, keyframe });
  return list.sort((a, b) => a.keyframe.time - b.keyframe.time);
}
