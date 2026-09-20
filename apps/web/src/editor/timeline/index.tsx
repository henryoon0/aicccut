/**
 * The timeline area. Classic layout (sticky headers, ruler, 44 px tracks) with
 * the contextual clip-editing surface (right-click menu, edge trimming, hint
 * bar) and the keyframe lanes that unfold under a single selected clip.
 */
import { Fragment, useState } from "react";
import { useActions, useEditor } from "#/editor/core";
import type { Clip, Track } from "#/editor/core";
import { cn } from "#/lib/utils";
import { ClipView } from "./clip";
import type { DropGhost } from "./drag";
import { useTimelineDrags } from "./drag";
import { usePlaybackAutoscroll, useScrub, useViewport } from "./engine";
import type { TrimState } from "./drag";
import { HEADER_W, RULER_H, TRACK_H, TRACK_H_TALL, formatDelta } from "./geometry";
import { HintBar } from "./hint-bar";
import { KeyframeLanes } from "./lanes";
import { Playhead, SnapLine } from "./playhead";
import { Ruler } from "./ruler";
import { Toolbar } from "./toolbar";
import { TrackHeader } from "./track-header";

const toggle = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

export function Timeline() {
  const actions = useActions();
  const view = useViewport();
  const drags = useTimelineDrags(view);
  const scrub = useScrub(view);
  usePlaybackAutoscroll(view);

  const tracks = useEditor((s) => s.doc.tracks);
  const clips = useEditor((s) => s.doc.clips);
  const selection = useEditor((s) => s.selection.clipIds);
  const [tall, setTall] = useState<Set<string>>(() => new Set());
  const [solo, setSolo] = useState<Set<string>>(() => new Set());

  const laneClip = selection.length === 1 ? clips.find((c) => c.id === selection[0]) : undefined;

  return (
    <div data-testid="timeline" className="flex h-full min-h-0 w-full flex-col bg-surface-2">
      <Toolbar view={view} />
      <div className="relative min-h-0 flex-1">
        <div
          ref={view.scrollRef}
          className="absolute inset-0 overflow-auto"
          onPointerDown={(e) => {
            // Portalled children (the clip menu) bubble through React, not
            // the DOM: only a press on the lanes themselves clears the selection.
            if (e.button === 0 && e.currentTarget.contains(e.target as Node)) actions.clearSelection();
          }}
        >
          <div className="relative" style={{ width: HEADER_W + view.contentW, minHeight: "100%" }}>
            <div className="sticky top-0 z-30 flex" style={{ height: RULER_H }}>
              <div
                className="sticky left-0 z-10 flex shrink-0 items-end border-b border-r border-border bg-surface-3 px-2 pb-1 text-[10px] text-muted-foreground"
                style={{ width: HEADER_W }}
              >
                <span>트랙</span>
                <span className="ml-auto tabular-nums">{view.pps.toFixed(0)} px/s</span>
              </div>
              <Ruler view={view} onScrub={scrub} />
            </div>

            <div ref={view.rowsRef}>
              {tracks.map((track) => {
                const height = tall.has(track.id) ? TRACK_H_TALL : TRACK_H;
                const lane = clips.filter((c) => c.trackId === track.id);
                return (
                  <Fragment key={track.id}>
                    <div data-track-row={track.id} className="flex border-b border-border/60" style={{ height }}>
                      <TrackHeader
                        track={track}
                        tall={tall.has(track.id)}
                        solo={solo.has(track.id)}
                        clips={lane.length}
                        onTall={() => setTall((s) => toggle(s, track.id))}
                        onSolo={() => setSolo((s) => toggle(s, track.id))}
                      />
                      <Lane
                        track={track}
                        clips={lane}
                        height={height}
                        view={view}
                        drags={drags}
                        laneClipId={laneClip?.id}
                        dimmed={solo.size > 0 && !solo.has(track.id)}
                        ghost={drags.ghost?.trackId === track.id ? drags.ghost : null}
                      />
                    </div>
                    {laneClip && laneClip.trackId === track.id && <KeyframeLanes clip={laneClip} view={view} />}
                  </Fragment>
                );
              })}
            </div>

            <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: HEADER_W, right: 0 }}>
              <SnapLine at={drags.snapLine} pps={view.pps} />
            </div>
          </div>
        </div>
        <Playhead view={view} onScrub={scrub} />
        {drags.trim && <TrimChip trim={drags.trim} />}
      </div>
      <HintBar trim={drags.trim} />
    </div>
  );
}

function Lane({
  track,
  clips,
  height,
  view,
  drags,
  laneClipId,
  dimmed,
  ghost,
}: {
  track: Track;
  clips: Clip[];
  height: number;
  view: ReturnType<typeof useViewport>;
  drags: ReturnType<typeof useTimelineDrags>;
  laneClipId: string | undefined;
  dimmed: boolean;
  ghost: DropGhost | null;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0",
        track.locked && "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-hover)_6px_7px)]",
        (track.hidden || dimmed) && "opacity-40",
      )}
      style={{ width: view.contentW, height }}
    >
      {clips.map((clip) => (
        <ClipView
          key={clip.id}
          clip={clip}
          track={track}
          pps={view.pps}
          height={height}
          drags={drags}
          lanesOpen={laneClipId === clip.id}
        />
      ))}
      {ghost && (
        <div
          className="pointer-events-none absolute inset-y-[3px] rounded-[3px] border border-dashed"
          style={{
            left: ghost.time * view.pps,
            width: Math.max(4, ghost.duration * view.pps),
            borderColor: ghost.tint,
            background: `color-mix(in srgb, ${ghost.tint} 18%, transparent)`,
          }}
        >
          <span className="truncate px-1.5 text-[10px] leading-[14px] text-foreground/80">{ghost.label}</span>
        </div>
      )}
    </div>
  );
}

/** Floating readout that follows the cursor while an edge is being trimmed. */
function TrimChip({ trim }: { trim: TrimState }) {
  return (
    <div
      data-testid="trim-chip"
      className="pointer-events-none fixed z-50 rounded-md bg-surface-6 px-2 py-1 text-[11px] font-medium tabular-nums text-foreground shadow-surface-6"
      style={{ left: trim.clientX + 12, top: trim.clientY - 30 }}
    >
      {formatDelta(trim.delta)} · {trim.duration.toFixed(2)}초
    </div>
  );
}
