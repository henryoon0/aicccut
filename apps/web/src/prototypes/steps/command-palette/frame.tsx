"use client";

/**
 * The realistic editor frame behind every palette in this step: top bar
 * with transport and the ⌘K hint, dim preview canvas, timeline strip.
 * State comes from `useEditor` in ./shared.
 */

import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Command, Magnet, Pause, Play, SkipBack, Waves, type LucideIcon } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { cn } from "#/lib/utils.ts";
import { CLIPS, PROJECT_DURATION, TRACKS, timecode, type Clip } from "#/prototypes/mock";
import { Keys, PROJECT, type Editor, type EditorState } from "./shared";

const FPS = PROJECT.fps;


/* ─────────────────────── Editor frame ─────────────────────── */

export interface EditorFrameProps {
  editor: Editor;
  onOpenPalette: () => void;
  /** Extra controls after the ⌘K hint (e.g. a "Shortcuts" button). */
  topRight?: ReactNode;
  /** Clicking a clip selects it. */
  selectable?: boolean;
  /** Overlays (palette, sheet, toast) rendered over the frame. */
  children?: ReactNode;
}

export function EditorFrame({ editor, onOpenPalette, topRight, selectable, children }: EditorFrameProps) {
  const { state, run, selectClip, seek } = editor;
  const activeText =
    state.texts.find((t) => state.time >= t.start && state.time < t.start + 4) ??
    CLIPS.filter((c) => c.trackId === "t-text" && !state.deleted.includes(c.id)).find(
      (c) => state.time >= c.start && state.time < c.start + c.duration
    );
  const videoClip = CLIPS.filter((c) => c.trackId === "t-v1" && !state.deleted.includes(c.id)).find(
    (c) => state.time >= c.start && state.time < c.start + c.duration
  );

  return (
    <div className="relative flex h-full w-full select-none flex-col overflow-hidden bg-surface-1 text-foreground">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3">
        <span className="size-2.5 rounded-sm" style={{ background: PROJECT.tint }} />
        <span className="min-w-0 truncate text-[13px] font-medium">{PROJECT.name}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {PROJECT.aspect} · {PROJECT.fps}fps
        </span>
        <div className="mx-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-compact" aria-label="Go to start" onClick={() => run("goto-start")}>
            <SkipBack />
          </Button>
          <Button variant="ghost" size="icon-compact" aria-label="Play / Pause" onClick={() => run("play")}>
            {state.playing ? <Pause /> : <Play />}
          </Button>
          <span className="ml-1 w-[92px] text-[12px] tabular-nums text-muted-foreground">
            {timecode(state.time, FPS)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatePill icon={Magnet} label="Snap" on={state.snapping} onClick={() => run("toggle-snap")} />
          <StatePill icon={Waves} label="Ripple" on={state.ripple} onClick={() => run("ripple")} />
          <Button variant="secondary" size="compact" leadingIcon={Command} onClick={onOpenPalette} className="ml-1 shrink-0">
            <span className="flex items-center gap-2 whitespace-nowrap">
              Commands
              <Keys shortcut="mod+k" className="-mr-1" />
            </span>
          </Button>
          {topRight}
          <Button variant="primary" size="compact" onClick={() => run("export")}>
            Export
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 place-items-center p-6">
        <div
          className="relative aspect-video max-h-full w-full max-w-[760px] overflow-hidden rounded-md bg-surface-3 shadow-surface-2"
          style={{
            backgroundImage: videoClip
              ? `linear-gradient(135deg, ${videoClip.tint}66, ${videoClip.tint}11 60%, transparent)`
              : undefined,
          }}
        >
          {state.safeAreas && (
            <>
              <div className="pointer-events-none absolute inset-[5%] rounded-sm border border-dashed border-foreground/30" />
              <div className="pointer-events-none absolute inset-[10%] rounded-sm border border-foreground/20" />
            </>
          )}
          {activeText && (
            <div className="absolute inset-x-0 bottom-[14%] text-center text-[clamp(14px,2.6vw,26px)] font-semibold tracking-tight text-white drop-shadow">
              {activeText.label}
            </div>
          )}
          <div className="absolute bottom-2 left-2.5 text-[11px] tabular-nums text-white/60">
            {videoClip?.label ?? "—"} · {timecode(state.time, FPS)}
          </div>
        </div>
      </div>

      <TimelineStrip state={state} selectable={!!selectable} onSelect={selectClip} onSeek={seek} />
      {children}
    </div>
  );
}

function StatePill({
  icon: Icon,
  label,
  on,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-7 items-center gap-1 rounded-md px-2 text-[11px] transition-colors hover:bg-hover",
        on ? "text-foreground" : "text-muted-foreground/60"
      )}
    >
      <Icon size={12} strokeWidth={on ? 2 : 1.5} />
      {label}
      <span className={cn("size-1.5 rounded-full", on ? "bg-emerald-500" : "bg-surface-6")} />
    </button>
  );
}

/* ─────────────────────── Timeline strip ─────────────────────── */

function TimelineStrip({
  state,
  selectable,
  onSelect,
  onSeek,
}: {
  state: EditorState;
  selectable: boolean;
  onSelect: (id: string | null) => void;
  onSeek: (t: number) => void;
}) {
  const laneRef = useRef<HTMLDivElement | null>(null);
  const pct = (t: number) => `${(t / PROJECT_DURATION) * 100}%`;
  const timeAt = (e: ReactPointerEvent) => {
    const el = laneRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * PROJECT_DURATION;
  };
  const clips: Clip[] = [
    ...CLIPS.filter((c) => !state.deleted.includes(c.id)),
    ...state.texts.map((t) => ({
      id: t.id,
      trackId: "t-text",
      label: t.label,
      start: t.start,
      duration: 4,
      inPoint: 0,
      tint: "#ffd166",
    })),
  ];
  const ticks = Array.from({ length: Math.floor(PROJECT_DURATION / 10) + 1 }, (_, i) => i * 10);

  return (
    <div className="flex h-[188px] shrink-0 flex-col border-t border-border bg-surface-2">
      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="sticky left-0 z-10 flex w-[104px] shrink-0 flex-col border-r border-border bg-surface-2">
          <div className="h-6 shrink-0 border-b border-border/60" />
          {TRACKS.map((t) => (
            <div key={t.id} className="flex h-[26px] items-center px-2.5 text-[11px] text-muted-foreground">
              {t.name}
            </div>
          ))}
        </div>
        <div
          className="relative shrink-0"
          style={{ width: `calc((100% - 104px) * ${state.zoom})`, minWidth: 0 }}
          onPointerDown={(e) => {
            const t = timeAt(e);
            if (t !== null) {
              onSeek(t);
              if (selectable) onSelect(null);
            }
          }}
        >
          <div ref={laneRef} className="absolute inset-0" />
          <div className="relative h-6 border-b border-border/60 text-[10px] tabular-nums text-muted-foreground/70">
            {ticks.map((t) => (
              <span key={t} className="absolute top-1 -translate-x-1/2" style={{ left: pct(t) }}>
                {timecode(t, FPS).slice(3, 8)}
              </span>
            ))}
            {state.bookmarks.map((b, i) => (
              <span
                key={i}
                className="absolute bottom-0 size-2 -translate-x-1/2 rounded-t-sm bg-amber-400"
                style={{ left: pct(b) }}
              />
            ))}
          </div>
          {TRACKS.map((track) => (
            <div key={track.id} className="relative h-[26px] border-b border-border/40">
              {clips
                .filter((c) => c.trackId === track.id)
                .map((c) => {
                  const selected = state.selectedClipId === c.id;
                  return (
                    <div
                      key={c.id}
                      onPointerDown={(e) => {
                        if (!selectable) return;
                        e.stopPropagation();
                        onSelect(c.id);
                      }}
                      className={cn(
                        "absolute inset-y-[3px] flex items-center overflow-hidden rounded-[3px] px-1.5 text-[10px] leading-none text-white/90",
                        selectable && "cursor-pointer",
                        selected ? "ring-2 ring-foreground" : "ring-1 ring-black/20"
                      )}
                      style={{
                        left: pct(c.start),
                        width: pct(c.duration),
                        background: `linear-gradient(180deg, ${c.tint}cc, ${c.tint}88)`,
                      }}
                    >
                      <span className="truncate">{c.label}</span>
                      {state.cuts
                        .filter((k) => k.trackId === track.id && k.time > c.start && k.time < c.start + c.duration)
                        .map((k, i) => (
                          <span
                            key={i}
                            className="absolute inset-y-0 w-px bg-white/90"
                            style={{ left: `${((k.time - c.start) / c.duration) * 100}%` }}
                          />
                        ))}
                    </div>
                  );
                })}
            </div>
          ))}
          <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-red-500" style={{ left: pct(state.time) }}>
            <span className="absolute -top-0 left-1/2 size-2.5 -translate-x-1/2 rounded-b-sm bg-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
