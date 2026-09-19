/**
 * Export domain: the settings a user picks, and the numbers derived from
 * them. The size estimate is the prototype's formula re-pointed at the real
 * document and at the transport's in/out points.
 *
 * This build has no video encoder. `downloadProjectFile` is what the
 * Download destination really produces: the document plus the chosen
 * settings, written out as `<name>.opencut.json`.
 */
import { documentDuration, type Document } from "#/editor/core";

export type Format = "h264" | "h265" | "webm" | "gif" | "mp3";
export type Resolution = "source" | "4k" | "1080p" | "720p";
export type FpsChoice = "source" | "24" | "30" | "60";
export type Range = "whole" | "inout";
export type Destination = "download" | "drive" | "link";

export interface FormatDef {
  id: Format;
  label: string;
  ext: string;
  hint: string;
  /** Relative bitrate multiplier against H.264. */
  codec: number;
  audioOnly?: boolean;
}

export const FORMATS: readonly FormatDef[] = [
  { id: "h264", label: "MP4 · H.264", ext: "mp4", hint: "Plays everywhere", codec: 1 },
  { id: "h265", label: "MP4 · H.265", ext: "mp4", hint: "Smaller, needs newer devices", codec: 0.6 },
  { id: "webm", label: "WebM · VP9", ext: "webm", hint: "Web embeds, transparency", codec: 0.7 },
  { id: "gif", label: "GIF", ext: "gif", hint: "Silent loop, max 15 fps", codec: 1 },
  { id: "mp3", label: "MP3 · Audio only", ext: "mp3", hint: "Voice track and music", codec: 1, audioOnly: true },
];

export const RESOLUTIONS: readonly { id: Resolution; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "4k", label: "4K" },
  { id: "1080p", label: "1080p" },
  { id: "720p", label: "720p" },
];

export const FPS_CHOICES: readonly FpsChoice[] = ["source", "24", "30", "60"];

/** The extension every export in this build actually lands on. */
export const PROJECT_FILE_EXT = "opencut.json";

export interface ExportSettings {
  format: Format;
  resolution: Resolution;
  fps: FpsChoice;
  /** 0–100. */
  quality: number;
  range: Range;
}

export const DEFAULT_SETTINGS: ExportSettings = {
  format: "h264",
  resolution: "source",
  fps: "source",
  quality: 70,
  range: "whole",
};

/** Everything the formulas need from the document and the transport. */
export interface ExportContext {
  width: number;
  height: number;
  /** Project frame rate. */
  fps: number;
  /** Whole-document length, seconds. */
  duration: number;
  /** Resolved in point, seconds. */
  inPoint: number;
  /** Resolved out point, seconds. */
  outPoint: number;
  /** Whether the transport has a usable in/out range. */
  hasInOut: boolean;
}

/** Fold a document and the transport's in/out points into the formula inputs. */
export function exportContext(doc: Document, inPoint: number | null, outPoint: number | null): ExportContext {
  const duration = documentDuration(doc);
  const lo = Math.max(0, inPoint ?? 0);
  const hi = Math.min(duration, outPoint ?? duration);
  return {
    width: doc.project.width,
    height: doc.project.height,
    fps: doc.project.fps,
    duration,
    inPoint: lo,
    outPoint: hi,
    hasInOut: (inPoint !== null || outPoint !== null) && hi - lo > 0.05,
  };
}

export function formatDef(id: Format): FormatDef {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export function qualityLabel(q: number): string {
  if (q < 40) return "Low";
  if (q < 75) return "Medium";
  return "High";
}

/** Output pixel size: "source" keeps the canvas, the presets pin the short side. */
export function dimensions(s: ExportSettings, ctx: ExportContext): { width: number; height: number } {
  if (s.resolution === "source") return { width: ctx.width, height: ctx.height };
  const short = s.resolution === "4k" ? 2160 : s.resolution === "720p" ? 720 : 1080;
  const ratio = ctx.width / Math.max(1, ctx.height);
  return ratio >= 1
    ? { width: Math.round(short * ratio), height: short }
    : { width: short, height: Math.round(short / ratio) };
}

export function fpsValue(s: ExportSettings, ctx: ExportContext): number {
  const base = s.fps === "source" ? ctx.fps : Number(s.fps);
  return s.format === "gif" ? Math.min(base, 15) : base;
}

/** Timeline second the export starts at. */
export function rangeStart(s: ExportSettings, ctx: ExportContext): number {
  return s.range === "inout" && ctx.hasInOut ? ctx.inPoint : 0;
}

/** Length of the exported range, seconds. */
export function rangeSeconds(s: ExportSettings, ctx: ExportContext): number {
  return s.range === "inout" && ctx.hasInOut ? ctx.outPoint - ctx.inPoint : ctx.duration;
}

/** Plausible size estimate: pixels × fps × codec × quality × seconds. */
export function estimateBytes(s: ExportSettings, ctx: ExportContext): number {
  const seconds = rangeSeconds(s, ctx);
  const q = s.quality / 100;
  const def = formatDef(s.format);
  if (def.audioOnly) {
    const kbps = 96 + q * 224;
    return (kbps * 1000 * seconds) / 8;
  }
  const { width, height } = dimensions(s, ctx);
  const fps = fpsValue(s, ctx);
  if (s.format === "gif") {
    return width * height * fps * seconds * (0.05 + q * 0.12);
  }
  const bitsPerPixel = 0.045 + q * 0.11;
  const mbps = (width * height * fps * bitsPerPixel) / 1_000_000;
  return ((mbps * def.codec * 1_000_000) / 8) * seconds;
}

export function specLine(s: ExportSettings, ctx: ExportContext): string {
  const def = formatDef(s.format);
  if (def.audioOnly) return `${Math.round(96 + (s.quality / 100) * 224)} kbps · ${def.label}`;
  const { width, height } = dimensions(s, ctx);
  return `${width}×${height} · ${fpsValue(s, ctx)} fps · ${def.label}`;
}

/** Lowercased, dash-joined name that is safe as a file name (Korean survives). */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

export interface ProjectFile {
  kind: "opencut.project";
  version: 1;
  exportedAt: string;
  /** What the wizard was set to, kept so a future encoder can replay it. */
  export: {
    format: Format;
    container: string;
    resolution: Resolution;
    width: number;
    height: number;
    fps: number;
    quality: number;
    range: Range;
    startSeconds: number;
    durationSeconds: number;
    estimatedBytes: number;
  };
  document: Document;
}

export function buildProjectFile(doc: Document, s: ExportSettings, ctx: ExportContext): ProjectFile {
  const def = formatDef(s.format);
  const { width, height } = dimensions(s, ctx);
  return {
    kind: "opencut.project",
    version: 1,
    exportedAt: new Date().toISOString(),
    export: {
      format: s.format,
      container: def.ext,
      resolution: s.resolution,
      width,
      height,
      fps: fpsValue(s, ctx),
      quality: s.quality,
      range: s.range,
      startSeconds: Number(rangeStart(s, ctx).toFixed(3)),
      durationSeconds: Number(rangeSeconds(s, ctx).toFixed(3)),
      estimatedBytes: Math.round(estimateBytes(s, ctx)),
    },
    document: doc,
  };
}

/** Full name of the file this build writes, e.g. `my-project.opencut.json`. */
export function projectFileName(base: string): string {
  const clean = base.trim().replace(/\.(opencut\.)?json$/i, "");
  return `${clean || "untitled"}.${PROJECT_FILE_EXT}`;
}

/**
 * Write the project file to disk through a Blob and a synthetic anchor click.
 * Returns the file name used. Call from an event handler, never from render.
 */
export function downloadProjectFile(doc: Document, s: ExportSettings, ctx: ExportContext, base: string): string {
  const name = projectFileName(base);
  const json = JSON.stringify(buildProjectFile(doc, s, ctx), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari needs the URL alive until the download has actually started.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
