"use client";

/**
 * Helpers shared only inside the editor-shell step: the transport (playhead)
 * hook, the top bar, panel header rows and the timeline strip. Panel bodies
 * (media grid, preview canvas, inspector) live in ./panels.tsx.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Lock,
  Pause,
  Play,
  Redo2,
  Share2,
  SkipBack,
  Undo2,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { cn } from "#/lib/utils.ts";
import {
  CLIPS,
  PROJECTS,
  PROJECT_DURATION,
  TRACKS,
  timecode,
  type Clip,
  type Track,
} from "#/prototypes/mock";

export const PROJECT = PROJECTS[0];

/* ─────────────────────── Transport ─────────────────────── */

export interface Transport {
  time: number;
  playing: boolean;
  toggle: () => void;
  seek: (t: number) => void;
  stop: () => void;
}

/** Playhead state with a requestAnimationFrame clock while playing. */
export function useTransport(initial = 24): Transport {
  const [time, setTime] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (last.current !== null) {
        const dt = (now - last.current) / 1000;
        setTime((t) => {
          const next = t + dt;
          if (next >= PROJECT_DURATION) {
            setPlaying(false);
            return PROJECT_DURATION;
          }
          return next;
        });
      }
      last.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const seek = useCallback(
    (t: number) => setTime(Math.min(PROJECT_DURATION, Math.max(0, t))),
    []
  );
  const stop = useCallback(() => {
    setPlaying(false);
    setTime(0);
  }, []);
  return { time, playing, toggle, seek, stop };
}

/** Space toggles playback, Home rewinds. Attached to window via effect. */
export function useTransportKeys(t: Transport) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        t.toggle();
      } else if (e.key === "Home") t.seek(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [t]);
}

/** Clip on a track under the playhead. */
export function clipAt(trackId: string, time: number): Clip | undefined {
  return CLIPS.find(
    (c) => c.trackId === trackId && time >= c.start && time < c.start + c.duration
  );
}

/* ─────────────────────── Top bar ─────────────────────── */

export function TopBar({
  leading,
  center,
  trailing,
  className,
}: {
  leading?: ReactNode;
  center?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-1 px-2",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {leading}
        <div className="flex min-w-0 items-center gap-2 px-2">
          <span className="size-2 shrink-0 rounded-sm" style={{ background: PROJECT.tint }} />
          <span className="truncate text-[13px] font-medium text-foreground">{PROJECT.name}</span>
          <span className="hidden shrink-0 text-[11px] text-muted-foreground lg:inline">
            {PROJECT.width}×{PROJECT.height} · {PROJECT.fps}fps
          </span>
        </div>
        <div className="ml-1 flex items-center">
          <Tooltip content="Undo (⌘Z)" side="bottom">
            <Button variant="ghost" size="icon-compact" aria-label="Undo">
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip content="Redo (⇧⌘Z)" side="bottom">
            <Button variant="ghost" size="icon-compact" aria-label="Redo" disabled>
              <Redo2 />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center">{center}</div>
      <div className="flex shrink-0 items-center gap-1">
        {trailing}
        <Button variant="primary" size="compact" leadingIcon={Share2}>
          Export
        </Button>
      </div>
    </header>
  );
}

/* ─────────────────────── Panel chrome ─────────────────────── */

export function PanelHeader({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2.5 text-[12px] font-medium text-foreground",
        className
      )}
    >
      {Icon && <Icon size={13} className="text-muted-foreground" />}
      <span className="truncate">{title}</span>
      <div className="ml-auto flex items-center gap-0.5">{children}</div>
    </div>
  );
}

/* ─────────────────────── Transport controls ─────────────────────── */

export function TransportControls({ t, className }: { t: Transport; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Tooltip content="Go to start (Home)" side="top">
        <Button variant="ghost" size="icon-compact" aria-label="Go to start" onClick={t.stop}>
          <SkipBack />
        </Button>
      </Tooltip>
      <Tooltip content={t.playing ? "Pause (Space)" : "Play (Space)"} side="top">
        <Button
          variant="secondary"
          size="icon-compact"
          aria-label={t.playing ? "Pause" : "Play"}
          onClick={t.toggle}
        >
          {t.playing ? <Pause /> : <Play />}
        </Button>
      </Tooltip>
      <span className="ml-1 text-[12px] tabular-nums text-foreground">{timecode(t.time, PROJECT.fps)}</span>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        / {timecode(PROJECT_DURATION, PROJECT.fps)}
      </span>
    </div>
  );
}

/* ─────────────────────── Timeline strip ─────────────────────── */

const TRACK_TINT: Record<Track["kind"], string> = {
  video: "bg-surface-3",
  audio: "bg-surface-3",
  text: "bg-surface-3",
  effect: "bg-surface-3",
};

/** Scrubbable timeline drawing TRACKS/CLIPS as bars with a playhead. */
export function TimelineStrip({
  t,
  trackHeight = 28,
  headerWidth = 112,
  showRuler = true,
  tracks = TRACKS,
  className,
  onClipSelect,
  selectedClip,
}: {
  t: Transport;
  trackHeight?: number;
  headerWidth?: number;
  showRuler?: boolean;
  tracks?: Track[];
  className?: string;
  onClipSelect?: (id: string) => void;
  selectedClip?: string | null;
}) {
  const laneRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const pct = (s: number) => `${(s / PROJECT_DURATION) * 100}%`;

  const seekFromEvent = (e: ReactPointerEvent) => {
    const el = laneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    t.seek(((e.clientX - r.left) / r.width) * PROJECT_DURATION);
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-clip]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromEvent(e);
  };

  const marks = Array.from({ length: Math.floor(PROJECT_DURATION / 10) + 1 }, (_, i) => i * 10);

  return (
    <div className={cn("flex min-h-0 w-full flex-col overflow-hidden text-[11px]", className)}>
      {showRuler && (
        <div className="flex h-6 shrink-0 border-b border-border">
          <div className="shrink-0 border-r border-border" style={{ width: headerWidth }} />
          <div className="relative flex-1">
            {marks.map((m) => (
              <span
                key={m}
                className="absolute top-1 -translate-x-1/2 tabular-nums text-muted-foreground"
                style={{ left: pct(m) }}
              >
                {timecode(m, PROJECT.fps).slice(3, 8)}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <div className="shrink-0 overflow-hidden border-r border-border" style={{ width: headerWidth }}>
          {tracks.map((tr) => {
            const isMuted = muted[tr.id] ?? false;
            return (
              <div
                key={tr.id}
                className="flex items-center gap-1 border-b border-border px-2"
                style={{ height: trackHeight }}
              >
                <span className="min-w-0 flex-1 truncate text-foreground">{tr.name}</span>
                {tr.kind !== "text" && tr.kind !== "effect" && (
                  <button
                    type="button"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    aria-pressed={isMuted}
                    onClick={() => setMuted((m) => ({ ...m, [tr.id]: !isMuted }))}
                    className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
                  >
                    {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                )}
                <Lock size={11} className="text-muted-foreground/50" />
              </div>
            );
          })}
        </div>
        <div
          ref={laneRef}
          className="relative flex-1 cursor-crosshair select-none touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
        >
          {tracks.map((tr) => (
            <div
              key={tr.id}
              className={cn("relative border-b border-border", TRACK_TINT[tr.kind])}
              style={{ height: trackHeight }}
            >
              {CLIPS.filter((c) => c.trackId === tr.id).map((c) => {
                const selected = selectedClip === c.id;
                return (
                  <button
                    type="button"
                    data-clip
                    key={c.id}
                    onClick={() => onClipSelect?.(c.id)}
                    className={cn(
                      "absolute inset-y-[3px] flex items-center overflow-hidden rounded-[4px] px-1.5 text-left text-[10px] leading-none text-white/90 outline-none transition-[filter] duration-80 hover:brightness-110 focus-visible:ring-1 focus-visible:ring-ring",
                      tr.kind === "audio" && "opacity-80",
                      selected && "ring-1 ring-foreground ring-inset"
                    )}
                    style={{
                      left: pct(c.start),
                      width: pct(c.duration),
                      background:
                        tr.kind === "audio"
                          ? `repeating-linear-gradient(90deg, ${c.tint} 0 2px, transparent 2px 4px)`
                          : c.tint,
                      backgroundColor: c.tint,
                      opacity: muted[tr.id] ? 0.4 : undefined,
                    }}
                  >
                    <span className="truncate drop-shadow-sm">{c.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-destructive"
            style={{ left: pct(t.time) }}
          >
            <span className="absolute -top-0 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-destructive" />
          </div>
        </div>
      </div>
    </div>
  );
}
