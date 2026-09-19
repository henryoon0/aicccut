"use client";

/**
 * Helpers shared only inside the export step: the settings domain, the
 * live file-size estimate, the fake render clock (cancellable) and the dim
 * editor frame every variant renders behind its export UI.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Redo2, Undo2, Play, SkipBack, Volume2 } from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { Button } from "#/components/ui/button.tsx";
import { ASSETS, CLIPS, PROJECTS, PROJECT_DURATION, TRACKS, timecode } from "#/prototypes/mock";

export const PROJECT = PROJECTS[0];

/* ─────────────────────── Settings domain ─────────────────────── */

export type Format = "h264" | "h265" | "webm" | "gif" | "mp3";
export type Resolution = "source" | "4k" | "1080p" | "720p";
export type FpsChoice = "source" | "24" | "30" | "60";
export type Range = "whole" | "inout";

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

export const RESOLUTIONS: readonly { id: Resolution; label: string; hint: string }[] = [
  { id: "source", label: "Source", hint: `${PROJECT.width}×${PROJECT.height}` },
  { id: "4k", label: "4K", hint: "3840×2160" },
  { id: "1080p", label: "1080p", hint: "1920×1080" },
  { id: "720p", label: "720p", hint: "1280×720" },
];

export const FPS_CHOICES: readonly { id: FpsChoice; label: string }[] = [
  { id: "source", label: `Source (${PROJECT.fps})` },
  { id: "24", label: "24 fps" },
  { id: "30", label: "30 fps" },
  { id: "60", label: "60 fps" },
];

/** In/out points a user would have set on the timeline. */
export const IN_POINT = 12.4;
export const OUT_POINT = 62;

export interface ExportSettings {
  format: Format;
  resolution: Resolution;
  fps: FpsChoice;
  /** 0–100. */
  quality: number;
  range: Range;
  /** Optional aspect override (presets like Reels export 9:16). */
  aspect?: "16:9" | "9:16" | "1:1";
}

export const DEFAULT_SETTINGS: ExportSettings = {
  format: "h264",
  resolution: "source",
  fps: "source",
  quality: 60,
  range: "whole",
};

export const QUALITY_PRESETS = [
  { id: "low", label: "Low", value: 25 },
  { id: "medium", label: "Medium", value: 60 },
  { id: "high", label: "High", value: 90 },
] as const;

export function qualityLabel(q: number): string {
  if (q < 40) return "Low";
  if (q < 75) return "Medium";
  return "High";
}

export function formatDef(id: Format): FormatDef {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export function dimensions(s: ExportSettings): { width: number; height: number } {
  const short = s.resolution === "4k" ? 2160 : s.resolution === "720p" ? 720 : 1080;
  const [aw, ah] = (s.aspect ?? "16:9").split(":").map(Number);
  if (s.resolution === "source" && !s.aspect) return { width: PROJECT.width, height: PROJECT.height };
  return aw >= ah
    ? { width: Math.round((short * aw) / ah), height: short }
    : { width: short, height: Math.round((short * ah) / aw) };
}

export function fpsValue(s: ExportSettings): number {
  const base = s.fps === "source" ? PROJECT.fps : Number(s.fps);
  return s.format === "gif" ? Math.min(base, 15) : base;
}

export function rangeSeconds(s: ExportSettings): number {
  return s.range === "inout" ? OUT_POINT - IN_POINT : PROJECT_DURATION;
}

/** Plausible size estimate: pixels × fps × codec × quality × seconds. */
export function estimateBytes(s: ExportSettings): number {
  const seconds = rangeSeconds(s);
  const q = s.quality / 100;
  const def = formatDef(s.format);
  if (def.audioOnly) {
    const kbps = 96 + q * 224;
    return (kbps * 1000 * seconds) / 8;
  }
  const { width, height } = dimensions(s);
  const fps = fpsValue(s);
  if (s.format === "gif") {
    return width * height * fps * seconds * (0.05 + q * 0.12);
  }
  const bitsPerPixel = 0.045 + q * 0.11;
  const mbps = (width * height * fps * bitsPerPixel) / 1_000_000;
  return ((mbps * def.codec * 1_000_000) / 8) * seconds;
}

export function specLine(s: ExportSettings): string {
  const def = formatDef(s.format);
  if (def.audioOnly) return `${Math.round(96 + (s.quality / 100) * 224)} kbps · ${def.label}`;
  const { width, height } = dimensions(s);
  return `${width}×${height} · ${fpsValue(s)} fps · ${def.label}`;
}

export function fileName(s: ExportSettings, base = "claude-code-ep6"): string {
  const res = formatDef(s.format).audioOnly ? "" : `_${dimensions(s).height}p`;
  return `${base}${res}.${formatDef(s.format).ext}`;
}

/* ─────────────────────── Fake render clock ─────────────────────── */

export type RenderStatus = "idle" | "rendering" | "done" | "cancelled";

export interface RenderState {
  status: RenderStatus;
  /** 0–1. */
  progress: number;
  /** Seconds remaining. */
  eta: number;
  /** Frames per second being rendered. */
  fps: number;
  frame: number;
  totalFrames: number;
  /** Timeline time of the frame being rendered, seconds. */
  time: number;
  /** Tint of the clip under the render head. */
  tint: string;
}

const IDLE: RenderState = {
  status: "idle", progress: 0, eta: 0, fps: 0, frame: 0, totalFrames: 0, time: 0, tint: PROJECT.tint,
};

/** How long the fake render should take: heavier settings render longer. */
export function renderDurationMs(s: ExportSettings): number {
  if (formatDef(s.format).audioOnly) return 6000;
  const base = s.resolution === "4k" ? 10000 : s.resolution === "720p" ? 6000 : 7500;
  return s.range === "inout" ? Math.max(6000, base * 0.75) : base;
}

/** Tint of the topmost visible video clip at a timeline time. */
export function tintAt(time: number): string {
  for (const trackId of ["t-v2", "t-v1"]) {
    const clip = CLIPS.find((c) => c.trackId === trackId && time >= c.start && time < c.start + c.duration);
    if (clip) return clip.tint;
  }
  return PROJECT.tint;
}

export function useRender() {
  const [state, setState] = useState<RenderState>(IDLE);
  const raf = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback((s: ExportSettings) => {
    stop();
    const durationMs = renderDurationMs(s);
    const seconds = rangeSeconds(s);
    const offset = s.range === "inout" ? IN_POINT : 0;
    const totalFrames = Math.round(seconds * fpsValue(s));
    let t0: number | null = null;
    const tick = (now: number) => {
      if (t0 === null) t0 = now;
      // Ease so the bar slows a touch near the end like a real encoder.
      const linear = Math.min(1, (now - t0) / durationMs);
      const p = linear < 0.9 ? linear : 0.9 + (linear - 0.9) * 0.85 + (linear === 1 ? 0.015 : 0);
      const progress = Math.min(1, p);
      const elapsed = (now - t0) / 1000;
      const frame = Math.round(progress * totalFrames);
      const time = offset + progress * seconds;
      setState({
        status: linear >= 1 ? "done" : "rendering",
        progress: linear >= 1 ? 1 : progress,
        eta: Math.max(0, (durationMs / 1000) - elapsed),
        fps: elapsed > 0.2 ? Math.round(frame / elapsed) : 0,
        frame: linear >= 1 ? totalFrames : frame,
        totalFrames,
        time,
        tint: tintAt(time),
      });
      if (linear < 1) raf.current = requestAnimationFrame(tick);
      else raf.current = null;
    };
    setState({ ...IDLE, status: "rendering", totalFrames, tint: tintAt(offset), time: offset });
    raf.current = requestAnimationFrame(tick);
  }, [stop]);

  const cancel = useCallback(() => {
    stop();
    setState((prev) => ({ ...prev, status: "cancelled" }));
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setState(IDLE);
  }, [stop]);

  return { state, start, cancel, reset };
}

export function etaLabel(seconds: number): string {
  if (seconds < 1) return "a moment";
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  return `${Math.floor(seconds / 60)}m ${String(Math.ceil(seconds % 60)).padStart(2, "0")}s left`;
}

/* ─────────────────────── Editor frame ─────────────────────── */

interface EditorFrameProps {
  /** Content for the right end of the top bar (usually the Export button). */
  topRight?: ReactNode;
  /** Something to render under the top bar, full width (Minimal's inline bar). */
  belowTopBar?: ReactNode;
  /** Right-side sibling of the editor body, e.g. a slide-in panel. */
  aside?: ReactNode;
  /** Dim the editor when a modal sits on top. */
  dim?: boolean;
  /** Overlay content rendered above the frame (dialogs, toasts). */
  children?: ReactNode;
  className?: string;
  frameRef?: (el: HTMLDivElement | null) => void;
}

export function EditorFrame({ topRight, belowTopBar, aside, dim, children, className, frameRef }: EditorFrameProps) {
  return (
    <div ref={frameRef} className={cn("relative flex h-full w-full flex-col overflow-hidden bg-surface-1 text-foreground", className)}>
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3">
        <span className="size-2.5 rounded-full" style={{ background: PROJECT.tint }} />
        <span className="truncate text-[13px] font-medium">{PROJECT.name}</span>
        <span className="text-[11px] text-muted-foreground">Saved</span>
        <div className="ml-4 flex items-center gap-0.5">
          <Button variant="ghost" size="icon-compact" aria-label="Undo"><Undo2 /></Button>
          <Button variant="ghost" size="icon-compact" aria-label="Redo"><Redo2 /></Button>
        </div>
        <span className="mx-auto font-mono text-[12px] tabular-nums text-muted-foreground">{timecode(17.5)}</span>
        <div className="flex items-center gap-2">{topRight}</div>
      </header>
      {belowTopBar}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <MediaStrip />
            <Preview />
            <Inspector />
          </div>
          <Timeline />
        </div>
        {aside}
      </div>
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-black/55 transition-opacity duration-200", dim ? "opacity-100" : "opacity-0")}
      />
      {children}
    </div>
  );
}

function MediaStrip() {
  return (
    <aside className="hidden w-44 shrink-0 flex-col border-r border-border bg-surface-2 p-2 lg:flex">
      <div className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">Media</div>
      <div className="grid grid-cols-2 gap-1.5">
        {ASSETS.slice(0, 8).map((a) => (
          <div key={a.id} className="aspect-video rounded-sm opacity-70" style={{ background: `linear-gradient(135deg, ${a.tint}, ${a.tint}88)` }} />
        ))}
      </div>
    </aside>
  );
}

function Preview() {
  return (
    <section className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-surface-1 p-6">
      <div
        className="aspect-video w-full max-w-[720px] rounded-md shadow-surface-3"
        style={{ background: `radial-gradient(120% 120% at 20% 10%, ${tintAt(17.5)} 0%, #0b0d14 70%)` }}
      />
      <div className="flex items-center gap-1 text-muted-foreground">
        <Button variant="ghost" size="icon-compact" aria-label="Go to start"><SkipBack /></Button>
        <Button variant="ghost" size="icon-compact" aria-label="Play"><Play /></Button>
        <Button variant="ghost" size="icon-compact" aria-label="Volume"><Volume2 /></Button>
        <span className="ml-2 font-mono text-[11px] tabular-nums">{timecode(17.5)} / {timecode(PROJECT_DURATION)}</span>
      </div>
    </section>
  );
}

function Inspector() {
  const rows = [["Position", "0, 0"], ["Scale", "100%"], ["Rotation", "0°"], ["Opacity", "100%"], ["Blend", "Normal"]];
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-l border-border bg-surface-2 p-3 xl:flex">
      <div className="mb-3 text-[11px] font-medium text-muted-foreground">Inspector</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between border-b border-border/60 py-2 text-[12px]">
          <span className="text-muted-foreground">{k}</span>
          <span className="tabular-nums">{v}</span>
        </div>
      ))}
    </aside>
  );
}

function Timeline() {
  return (
    <div className="flex h-40 shrink-0 border-t border-border bg-surface-2">
      <div className="w-28 shrink-0 border-r border-border">
        <div className="h-5 border-b border-border" />
        {TRACKS.map((t) => (
          <div key={t.id} className="flex h-[22px] items-center px-2 text-[11px] text-muted-foreground">{t.name}</div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="flex h-5 border-b border-border font-mono text-[10px] tabular-nums text-muted-foreground">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="shrink-0 border-l border-border/60 pl-1" style={{ width: "10%" }}>{timecode(i * 10).slice(3, 8)}</div>
          ))}
        </div>
        {TRACKS.map((t) => (
          <div key={t.id} className="relative h-[22px] border-b border-border/40">
            {CLIPS.filter((c) => c.trackId === t.id).map((c) => (
              <div
                key={c.id}
                className="absolute top-[3px] h-4 truncate rounded-sm px-1 text-[10px] leading-4 text-black/70"
                style={{ left: `${(c.start / PROJECT_DURATION) * 100}%`, width: `${(c.duration / PROJECT_DURATION) * 100}%`, background: c.tint }}
              >
                {c.label}
              </div>
            ))}
          </div>
        ))}
        <div className="absolute bottom-0 top-0 w-px bg-foreground" style={{ left: `${(17.5 / PROJECT_DURATION) * 100}%` }} />
      </div>
    </div>
  );
}

/* ─────────────────────── Small atoms ─────────────────────── */

/** A frame thumbnail whose tint follows the render head. */
export function FrameThumb({ tint, className, children }: { tint: string; className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn("relative aspect-video overflow-hidden rounded-md transition-colors duration-300", className)}
      style={{ background: `radial-gradient(120% 120% at 20% 10%, ${tint} 0%, #0b0d14 75%)` }}
    >
      {children}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function ProgressBar({ value, className, tint }: { value: number; className?: string; tint?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-5", className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-foreground" style={{ width: `${value * 100}%`, background: tint }} />
    </div>
  );
}
