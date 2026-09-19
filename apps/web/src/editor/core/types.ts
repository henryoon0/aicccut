/**
 * Shared data model of the editor. Every other core module builds on these
 * shapes; UI code should import them from `#/editor/core`.
 *
 * Units: time is seconds, positions are canvas pixels, scale/opacity are
 * percent (100 = unchanged), rotation is degrees.
 */

export type Seconds = number;
export type Frames = number;

export type Aspect = "16:9" | "9:16" | "1:1" | "4:5";
export type Fps = 24 | 25 | 30 | 60;

export interface Project {
  id: string;
  name: string;
  aspect: Aspect;
  fps: Fps;
  width: number;
  height: number;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp, bumped on every save. */
  updatedAt: string;
  /** Solid colour used where a thumbnail would be. */
  tint: string;
}

export type AssetKind = "video" | "audio" | "image";

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  /** Seconds; images have 0. */
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  /** Bytes. */
  size: number;
  tint: string;
  /** ISO timestamp. */
  addedAt: string;
}

export type TrackKind = "video" | "audio" | "text" | "effect";

export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
}

export type TrackFlag = "muted" | "locked" | "hidden";

export const BLEND_MODES = [
  "Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten",
  "Color Dodge", "Color Burn", "Hard Light", "Soft Light", "Difference", "Exclusion",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export type EffectType = "blur" | "brightness" | "contrast" | "saturation" | "vignette" | "sharpen";

export interface EffectInstance {
  id: string;
  type: EffectType;
  enabled: boolean;
  /** Effect-specific numbers, e.g. `{ amount: 12 }`. See `EFFECT_DEFAULTS`. */
  params: Record<string, number>;
}

// ── Animation ──────────────────────────────────────────────

export type EasingPreset = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "spring";
/** A preset name, or explicit cubic-bezier control points [x1, y1, x2, y2]. */
export type Easing = EasingPreset | [number, number, number, number];

/** Channels a clip can animate. `blur` drives the blur effect amount. */
export type Channel = "x" | "y" | "scale" | "rotation" | "opacity" | "blur";

export interface Keyframe {
  id: string;
  /** Seconds from the clip's start (not the timeline). */
  time: number;
  value: number;
  /** Easing of the segment leaving this keyframe. */
  easing: Easing;
}

export type KeyframeMap = Partial<Record<Channel, Keyframe[]>>;
export type ChannelValues = Record<Channel, number>;

// ── Text ───────────────────────────────────────────────────

export type TextAlign = "left" | "center" | "right";

/** Typographic style of a text clip. Position comes from `ClipProps.x/y`. */
export interface TextStyle {
  font: string;
  /** Font size in canvas pixels. */
  size: number;
  weight: number;
  italic: boolean;
  /** Letter spacing in em × 100 (0 = normal, -5 = -0.05em). */
  tracking: number;
  /** Unitless line height × 100 (120 = 1.2). */
  leading: number;
  color: string;
  align: TextAlign;
}

export type ClipText = TextStyle & { content: string };

// ── Clips ──────────────────────────────────────────────────

export interface ClipProps {
  /** Offset from canvas centre, px. */
  x: number;
  y: number;
  /** Percent, 100 = native. */
  scale: number;
  /** Degrees. */
  rotation: number;
  /** Percent, 0–100. */
  opacity: number;
  blend: BlendMode;
  /** Present on text clips only. */
  text?: ClipText;
  effects: EffectInstance[];
  keyframes: KeyframeMap;
}

export interface Clip {
  id: string;
  trackId: string;
  /** Absent for text and effect clips. */
  assetId?: string;
  /** Display label (asset name, text content or effect name). */
  label: string;
  /** Timeline start, seconds. */
  start: number;
  /** Duration on the timeline, seconds. */
  duration: number;
  /** Trim offset into the source, seconds. */
  inPoint: number;
  tint: string;
  muted?: boolean;
  props: ClipProps;
}

export type Edge = "start" | "end";

export interface Bookmark {
  id: string;
  time: number;
  label: string;
  color: string;
}

/** Everything that gets persisted for one project. */
export interface Document {
  project: Project;
  assets: Asset[];
  tracks: Track[];
  clips: Clip[];
  bookmarks: Bookmark[];
}

export interface Selection {
  clipIds: string[];
}

// ── Timecode helpers ───────────────────────────────────────

/** "hh:mm:ss.ff" as produced by `timecode()`. */
export type TimecodeString = string;

export interface TimecodeParts {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
}
