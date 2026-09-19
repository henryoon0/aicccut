/**
 * Editor frame, preview and timeline chrome shared by the clip-editing
 * variants. Variants own the *editing interaction*; this file owns the
 * realistic surroundings so every variant is judged on the same stage.
 */
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type PointerEvent as RPE, type ReactNode } from "react";
import { AudioLines, Film, Mic, Pause, Play, Redo2, Scissors, Sparkles, Type, Undo2, VolumeX } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Switch } from "#/components/ui/switch";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import { PROJECTS, PROJECT_DURATION, TRACKS, timecode, type Track } from "#/prototypes/mock";
import { applyTrim, endOf, snap, type EClip, type Edge, type EditorApi } from "./model";
import { MediaRail, Preview } from "./frame";

export const RULER_H = 24;
export const TRACK_H = 40;
export const HEADER_W = 112;

// ── generic pointer drag ──────────────────────────────────

export function startPointerDrag(
  e: RPE | PointerEvent,
  handlers: { onMove: (ev: PointerEvent, dx: number, dy: number) => void; onEnd?: (ev: PointerEvent) => void },
) {
  e.preventDefault();
  e.stopPropagation();
  const x0 = e.clientX;
  const y0 = e.clientY;
  const move = (ev: PointerEvent) => handlers.onMove(ev, ev.clientX - x0, ev.clientY - y0);
  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    handlers.onEnd?.(ev);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

// ── geometry ──────────────────────────────────────────────

export interface Geo {
  pps: number;
  x: (t: number) => number;
  t: (x: number) => number;
  /** Timeline seconds under a clientX, snapped to frames and clamped. */
  timeAt: (clientX: number) => number;
  left: number;
  width: number;
}

// ── trim drag hook ────────────────────────────────────────

export interface TrimState {
  clipId: string;
  edge: Edge;
  original: EClip;
  current: EClip;
  /** Seconds the edge moved (negative = shorter). */
  delta: number;
  clientX: number;
}

export function useTrimDrag(ed: EditorApi, geo: Geo | null) {
  const [trim, setTrim] = useState<TrimState | null>(null);
  const edRef = useRef(ed);
  edRef.current = ed;
  const start = useCallback(
    (e: RPE, clip: EClip, edge: Edge) => {
      if (!geo) return;
      const snapshot = edRef.current.clips;
      const ripple = edRef.current.ripple;
      setTrim({ clipId: clip.id, edge, original: clip, current: clip, delta: 0, clientX: e.clientX });
      startPointerDrag(e, {
        onMove: (ev, dx) => {
          const next = applyTrim(snapshot, clip.id, edge, dx / geo.pps, ripple);
          edRef.current.preview(next);
          const cur = next.find((c) => c.id === clip.id) ?? clip;
          const delta = edge === "start" ? -(cur.duration - clip.duration) : cur.duration - clip.duration;
          setTrim({ clipId: clip.id, edge, original: clip, current: cur, delta, clientX: ev.clientX });
        },
        onEnd: () => {
          edRef.current.commit(snapshot);
          setTrim(null);
        },
      });
    },
    [geo],
  );
  return { trim, start };
}

// ── frame ─────────────────────────────────────────────────

const project = PROJECTS[0];

export function EditorFrame({
  ed,
  tools,
  above,
  below,
  timeline,
  previewOverlay,
  className,
}: {
  ed: EditorApi;
  /** Right cluster of the top bar. Omit for the default (split · ripple · undo/redo). */
  tools?: ReactNode;
  /** Sits between preview and timeline (trim panels, toolbars). */
  above?: ReactNode;
  /** Sits under the timeline (hint bars). */
  below?: ReactNode;
  timeline: ReactNode;
  previewOverlay?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full w-full select-none flex-col bg-surface-1 text-foreground", className)}>
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3">
        <span className="truncate text-[13px] font-medium">{project.name}</span>
        <span className="text-[11px] text-muted-foreground">
          {project.width}×{project.height} · {project.fps} fps
        </span>
        <div className="mx-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-compact" aria-label={ed.playing ? "Pause" : "Play"} onClick={ed.togglePlay}>
            {ed.playing ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <span className="w-24 text-center font-medium tabular-nums text-[12px]">{timecode(ed.playhead)}</span>
        </div>
        <div className="flex items-center gap-2">{tools ?? <DefaultTools ed={ed} />}</div>
      </header>
      <div className="flex min-h-0 flex-1">
        <MediaRail />
        <Preview ed={ed}>{previewOverlay}</Preview>
      </div>
      {above}
      <div className="shrink-0 border-t border-border" style={{ height: RULER_H + TRACK_H * TRACKS.length + 2 }}>
        {timeline}
      </div>
      {below}
    </div>
  );
}

export function UndoRedo({ ed }: { ed: EditorApi }) {
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip content="Undo · ⌘Z" side="bottom">
        <Button variant="ghost" size="icon-compact" aria-label="Undo" disabled={!ed.canUndo} onClick={ed.undo}>
          <Undo2 size={14} />
        </Button>
      </Tooltip>
      <Tooltip content="Redo · ⇧⌘Z" side="bottom">
        <Button variant="ghost" size="icon-compact" aria-label="Redo" disabled={!ed.canRedo} onClick={ed.redo}>
          <Redo2 size={14} />
        </Button>
      </Tooltip>
    </div>
  );
}

export function RippleSwitch({ ed }: { ed: EditorApi }) {
  return (
    <Tooltip content="Ripple · R — closes gaps when you trim or delete" side="bottom">
      <div className={cn("flex items-center rounded-md px-1.5 py-0.5 text-[12px]", ed.ripple && "bg-selected")}>
        <Switch size="compact" label="Ripple" checked={ed.ripple} onToggle={ed.toggleRipple} />
      </div>
    </Tooltip>
  );
}

function DefaultTools({ ed }: { ed: EditorApi }) {
  return (
    <>
      <Tooltip content="Split at playhead · S" side="bottom">
        <Button variant="secondary" size="compact" leadingIcon={Scissors} onClick={() => ed.split()}>
          Split
        </Button>
      </Tooltip>
      <RippleSwitch ed={ed} />
      <UndoRedo ed={ed} />
    </>
  );
}

// ── timeline base ─────────────────────────────────────────

export interface ClipCtx {
  clip: EClip;
  track: Track;
  x: number;
  w: number;
  selected: boolean;
  geo: Geo;
}

export function TimelineBase({
  ed,
  renderClip,
  overlay,
  onGeo,
  onLanePointerDown,
  onLanePointerMove,
  onLaneLeave,
  laneCursor,
  laneClassName,
}: {
  ed: EditorApi;
  renderClip: (ctx: ClipCtx) => ReactNode;
  /** Rendered inside the lanes box (blade lines, ghosts…). */
  overlay?: (geo: Geo) => ReactNode;
  onGeo?: (geo: Geo) => void;
  onLanePointerDown?: (e: RPE, t: number, track: Track) => void;
  onLanePointerMove?: (e: RPE, t: number, track: Track) => void;
  onLaneLeave?: () => void;
  laneCursor?: string;
  laneClassName?: string;
}) {
  const lanesRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);

  useLayoutEffect(() => {
    const el = lanesRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const width = r.width - 16;
      const pps = width / PROJECT_DURATION;
      const g: Geo = {
        pps,
        left: r.left,
        width: r.width,
        x: (t) => t * pps,
        t: (x) => x / pps,
        timeAt: (clientX) => Math.min(PROJECT_DURATION, Math.max(0, snap((clientX - r.left) / pps))),
      };
      setGeo(g);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (geo) onGeo?.(geo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  const scrub = (e: RPE) => {
    if (!geo) return;
    ed.setPlayhead(geo.timeAt(e.clientX));
    startPointerDrag(e, { onMove: (ev) => ed.setPlayhead(geo.timeAt(ev.clientX)) });
  };

  const px = geo ? geo.x(ed.playhead) : 0;
  const ticks = geo ? Array.from({ length: PROJECT_DURATION + 1 }, (_, i) => i) : [];

  return (
    <div className="flex h-full bg-surface-2">
      <div className="shrink-0 border-r border-border" style={{ width: HEADER_W }}>
        <div className="border-b border-border" style={{ height: RULER_H }} />
        {TRACKS.map((t) => (
          <TrackHeader key={t.id} track={t} />
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="relative cursor-text border-b border-border" style={{ height: RULER_H }} onPointerDown={scrub}>
          {ticks.map((s) => {
            if (!geo) return null;
            const major = s % 5 === 0;
            return (
              <div key={s} className="absolute bottom-0" style={{ left: geo.x(s) }}>
                <div className={cn("w-px bg-border", major ? "h-3" : "h-1.5")} />
                {major && s < PROJECT_DURATION && (
                  <span className="absolute bottom-3 left-1 text-[10px] tabular-nums text-muted-foreground">{formatTick(s)}</span>
                )}
              </div>
            );
          })}
        </div>
        <div
          ref={lanesRef}
          className={cn("relative", laneClassName)}
          style={{ cursor: laneCursor }}
          onPointerLeave={onLaneLeave}
          onPointerMove={(e) => {
            if (!geo || !onLanePointerMove) return;
            const track = trackAtY(e.clientY, e.currentTarget);
            if (track) onLanePointerMove(e, geo.timeAt(e.clientX), track);
          }}
        >
          {TRACKS.map((t) => (
            <div
              key={t.id}
              className="relative border-b border-border/60"
              style={{ height: TRACK_H }}
              onPointerDown={(e) => {
                if (!geo) return;
                if (onLanePointerDown) onLanePointerDown(e, geo.timeAt(e.clientX), t);
                else if (e.target === e.currentTarget) ed.clearSelection();
              }}
            >
              {geo &&
                ed.clips
                  .filter((c) => c.trackId === t.id)
                  .map((c) => (
                    <Fragment key={c.id}>{renderClip({ clip: c, track: t, x: geo.x(c.start), w: geo.x(c.duration), selected: ed.selection.includes(c.id), geo })}</Fragment>
                  ))}
            </div>
          ))}
          {geo && overlay?.(geo)}
        </div>
        {geo && (
          <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: px }}>
            <div className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-[#ff5c5c]" />
            <div className="absolute -left-px top-0 h-full w-0.5 bg-[#ff5c5c]" />
          </div>
        )}
      </div>
    </div>
  );
}

function trackAtY(clientY: number, lanes: HTMLElement): Track | null {
  const r = lanes.getBoundingClientRect();
  const i = Math.floor((clientY - r.top) / TRACK_H);
  return TRACKS[i] ?? null;
}

function formatTick(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const KIND_ICON = { video: Film, audio: AudioLines, text: Type, effect: Sparkles } as const;

function TrackHeader({ track }: { track: Track }) {
  const Icon = track.kind === "audio" && track.id === "t-a1" ? Mic : KIND_ICON[track.kind];
  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 text-[11px] text-muted-foreground" style={{ height: TRACK_H }}>
      <Icon size={13} strokeWidth={1.75} />
      <span className="truncate font-medium text-foreground/80">{track.name}</span>
    </div>
  );
}

// ── clip box ──────────────────────────────────────────────

export function ClipBox({
  ctx,
  className,
  style,
  children,
  faded,
  ...rest
}: {
  ctx: ClipCtx;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Dim everything but the selection (razor/precision focus). */
  faded?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "style" | "className" | "children">) {
  const { clip, track, x, w, selected } = ctx;
  const audio = track.kind === "audio";
  return (
    <div
      data-clip={clip.id}
      className={cn(
        "absolute inset-y-[3px] overflow-hidden rounded-md text-[11px] leading-none outline-none",
        "transition-[opacity,box-shadow] duration-100",
        selected ? "z-10" : "z-0",
        faded && !selected && "opacity-40",
        className,
      )}
      style={{
        left: x,
        width: Math.max(w, 6),
        background: audio ? `${clip.tint}33` : `linear-gradient(180deg, ${clip.tint}b0, ${clip.tint}70)`,
        boxShadow: selected ? `inset 0 0 0 1.5px #fff, 0 0 0 1px ${clip.tint}` : `inset 0 0 0 1px ${clip.tint}66`,
        ...style,
      }}
      {...rest}
    >
      {audio && <Waveform tint={clip.tint} seed={clip.id} />}
      {track.kind === "video" && <Sprockets />}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1 truncate px-1.5 pt-[6px]">
        {clip.muted && <VolumeX size={10} className="shrink-0 text-white/80" />}
        <span className={cn("truncate font-medium", audio ? "text-foreground/90" : "text-white/95", clip.muted && "line-through opacity-70")}>{clip.label}</span>
      </div>
      {children}
    </div>
  );
}

function Waveform({ tint, seed }: { tint: string; seed: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  const bars = Array.from({ length: 160 }, (_, i) => 30 + Math.abs(Math.sin(i * 0.7 + h) * 50 + Math.sin(i * 0.23 + h * 0.5) * 20));
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full" preserveAspectRatio="none" viewBox="0 0 160 100">
      {bars.map((b, i) => (
        <rect key={i} x={i} y={100 - b} width={0.6} height={b} fill={tint} opacity={0.75} />
      ))}
    </svg>
  );
}

function Sprockets() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[10px] opacity-40"
      style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,.6) 0 2px, transparent 2px 9px)", backgroundSize: "9px 4px", backgroundRepeat: "repeat-x", backgroundPosition: "0 3px" }}
    />
  );
}

/** Ghost outline of a clip's original extent while it's being trimmed. */
export function GhostExtent({ trim, geo }: { trim: TrimState | null; geo: Geo }) {
  if (!trim) return null;
  const ti = trackIndex(trim.original.trackId);
  return (
    <div
      className="pointer-events-none absolute z-0 rounded-md border border-dashed border-foreground/50"
      style={{ left: geo.x(trim.original.start), width: geo.x(trim.original.duration), top: ti * TRACK_H + 3, height: TRACK_H - 6 }}
    />
  );
}

export const trackIndex = (trackId: string) => Math.max(0, TRACKS.findIndex((t) => t.id === trackId));

export { endOf };
