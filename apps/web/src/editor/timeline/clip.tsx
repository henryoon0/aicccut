/**
 * A clip on a lane: filmstrip for video, deterministic waveform for audio,
 * tinted block for text and effects. Edges are trim handles; right-click
 * opens the action menu.
 */
import { useMemo } from "react";
import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { VolumeOffIcon } from "@hugeicons/core-free-icons";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "#/components/ui/context-menu";
import { CHANNELS, allKeyframes, useActions, useEditor, useEditorStore } from "#/editor/core";
import type { Clip, Edge, Track } from "#/editor/core";
import { cn } from "#/lib/utils";
import { ClipMenuItems } from "./clip-menu";
import type { TimelineDrags } from "./drag";
import { filmstripStyle, hashSeed, waveformBars } from "./geometry";

export function ClipView({
  clip,
  track,
  pps,
  height,
  drags,
  lanesOpen,
}: {
  clip: Clip;
  track: Track;
  pps: number;
  height: number;
  drags: TimelineDrags;
  /** True when this clip's keyframe lanes are already unfolded below. */
  lanesOpen: boolean;
}) {
  const actions = useActions();
  const store = useEditorStore();
  const selected = useEditor((s) => s.selection.clipIds.includes(clip.id));
  const dragging = drags.dragId === clip.id;
  const trimming = drags.trim?.clipId === clip.id;
  const width = Math.max(2, clip.duration * pps);
  const isVideo = track.kind === "video";
  const isAudio = track.kind === "audio";
  const keyframes = useMemo(() => allKeyframes(clip.props.keyframes), [clip.props.keyframes]);

  return (
    <ContextMenu
      onOpenChange={(open: boolean) => {
        if (open && !store.getState().selection.clipIds.includes(clip.id)) actions.select(clip.id, false);
      }}
    >
      <ContextMenuTrigger
        render={
          <ClipBox
            data-clip={clip.id}
            aria-label={clip.label}
            onPointerDown={(e: ReactPointerEvent) => drags.onClipPointerDown(e, clip)}
            className={cn(
              "group",
              track.locked ? "cursor-not-allowed" : "cursor-grab",
              dragging && "z-20 opacity-90 shadow-surface-4",
              selected ? "z-10 ring-2 ring-foreground ring-offset-1 ring-offset-surface-2" : "ring-1 ring-black/40",
            )}
            style={{
              left: clip.start * pps,
              width,
              ...(isVideo
                ? filmstripStyle(clip.tint, Math.max(24, (height - 6) * (16 / 9)))
                : { background: `color-mix(in srgb, ${clip.tint} 28%, var(--color-surface-4))` }),
            }}
          >
            {isAudio && (
              <div className="absolute inset-x-0 bottom-0 top-[14px]">
                <Waveform id={clip.id} seconds={clip.duration} color={clip.tint} />
              </div>
            )}
            <div
              className={cn(
                "flex h-[14px] items-center gap-1 px-1.5 text-[10px] font-medium leading-none",
                isVideo ? "bg-black/45 text-white" : "text-foreground/90",
              )}
              style={isVideo ? undefined : { background: `color-mix(in srgb, ${clip.tint} 45%, transparent)` }}
            >
              {clip.muted && <HugeiconsIcon icon={VolumeOffIcon} size={9} strokeWidth={2} className="shrink-0" />}
              <span className={cn("truncate", clip.muted && "line-through opacity-70")}>{clip.label}</span>
              {width > 140 && <span className="ml-auto tabular-nums opacity-70">{clip.duration.toFixed(1)}초</span>}
            </div>
            {keyframes.length > 0 && !lanesOpen && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0.5 h-2">
                {keyframes.map(({ channel, keyframe }) => (
                  <span
                    key={`${channel}-${keyframe.id}`}
                    className="absolute top-0 size-[5px] rotate-45 rounded-[1px]"
                    style={{ left: keyframe.time * pps - 2.5, background: CHANNELS[channel].color }}
                  />
                ))}
              </div>
            )}
            {!track.locked && (
              <>
                <EdgeZone side="start" active={trimming && drags.trim?.edge === "start"} onDown={(e) => drags.startTrim(e, clip, "start")} />
                <EdgeZone side="end" active={trimming && drags.trim?.edge === "end"} onDown={(e) => drags.startTrim(e, clip, "end")} />
              </>
            )}
          </ClipBox>
        }
      />
      <ContextMenuContent className="min-w-60 bg-surface-5 shadow-surface-5">
        <ClipMenuItems clip={clip} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** The positioned box itself; kept separate so the menu trigger can render it. */
function ClipBox({
  className,
  style,
  children,
  ...rest
}: { className?: string; style?: CSSProperties; children?: ReactNode } & Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "style" | "children"
>) {
  return (
    <div className={cn("absolute inset-y-[3px] select-none overflow-hidden rounded-[3px]", className)} style={style} {...rest}>
      {children}
    </div>
  );
}

function EdgeZone({ side, active, onDown }: { side: Edge; active: boolean; onDown: (e: ReactPointerEvent) => void }) {
  return (
    <div
      className={cn(
        "absolute inset-y-0 z-20 w-2 cursor-col-resize opacity-0 transition-opacity duration-100 group-hover:opacity-100",
        active && "opacity-100",
        side === "start" ? "left-0" : "right-0",
      )}
      onPointerDown={onDown}
    >
      <div className={cn("absolute inset-y-0 w-[3px] bg-white/90", side === "start" ? "left-0" : "right-0")} />
    </div>
  );
}

function Waveform({ id, seconds, color }: { id: string; seconds: number; color: string }) {
  const bars = useMemo(() => waveformBars(hashSeed(id), seconds), [id, seconds]);
  return (
    <svg viewBox={`0 0 ${bars.length} 100`} preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      {bars.map((h, i) => (
        <rect key={i} x={i + 0.15} width={0.7} y={50 - h * 46} height={h * 92} fill={color} />
      ))}
    </svg>
  );
}
