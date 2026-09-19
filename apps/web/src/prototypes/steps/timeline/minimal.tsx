import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon, PauseIcon, Magnet01Icon, VolumeOffIcon, LockIcon, ViewOffIcon, VolumeHighIcon, LockOpenIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { Tooltip } from "#/components/ui/tooltip";
import type { Clip, Track } from "#/prototypes/mock";
import { EditorFrame, Playhead, SnapLine, Timecode, KindIcon, shortTime, tickSpec, range, useTimeline, type Engine } from "./shared";

const HEADER = 36;
const RULER = 18;
const TRACK = 32;

export function Minimal() {
  const engine = useTimeline({ headerW: HEADER, initialPps: 12 });
  return (
    <EditorFrame engine={engine} timelineHeight="42%">
      <div className="relative flex h-full flex-col bg-surface-1">
        <div ref={engine.scrollRef} className="absolute inset-0 overflow-auto" onPointerDown={engine.clearSelection}>
          <div className="relative" style={{ width: HEADER + engine.contentW, minHeight: "100%" }}>
            <div className="sticky top-0 z-30 flex" style={{ height: RULER }}>
              <div className="sticky left-0 z-10 shrink-0 bg-surface-1" style={{ width: HEADER }} />
              <Ruler engine={engine} />
            </div>
            {engine.tracks.map((t) => (
              <div key={t.id} className="group/track flex" style={{ height: TRACK }}>
                <TrackHeader track={t} engine={engine} />
                <Lane track={t} engine={engine} />
              </div>
            ))}
            <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: HEADER, right: 0 }}>
              <SnapLine engine={engine} className="w-px bg-foreground" />
            </div>
          </div>
        </div>
        <Playhead engine={engine} headerW={HEADER} lineClassName="w-px bg-foreground">
          <div className="h-[18px] w-3" />
        </Playhead>
        {/* Floating status: the only chrome. */}
        <div className="pointer-events-none absolute right-2 top-1.5 z-50 flex items-center gap-2 text-[11px] text-muted-foreground">
          <button type="button" onClick={engine.togglePlay} className="pointer-events-auto grid size-5 place-items-center rounded-sm hover:bg-hover hover:text-foreground" aria-label="Play">
            <HugeiconsIcon icon={engine.playing ? PauseIcon : PlayIcon} size={12} strokeWidth={1.5} />
          </button>
          <Timecode store={engine.store} className="text-foreground" />
          <button type="button" onClick={() => engine.setSnapOn(!engine.snapOn)} className={`pointer-events-auto grid size-5 place-items-center rounded-sm hover:bg-hover ${engine.snapOn ? "text-foreground" : "text-muted-foreground/50"}`} aria-label="Snapping">
            <HugeiconsIcon icon={Magnet01Icon} size={12} strokeWidth={1.5} />
          </button>
          <button type="button" onClick={engine.fit} className="pointer-events-auto rounded-sm px-1 tabular-nums hover:bg-hover hover:text-foreground">
            {engine.pps.toFixed(0)} px/s
          </button>
        </div>
      </div>
    </EditorFrame>
  );
}

function Ruler({ engine }: { engine: Engine }) {
  const { major, minor } = tickSpec(engine.pps, 64);
  return (
    <div className="relative shrink-0 cursor-ew-resize select-none border-b border-border bg-surface-1" style={{ width: engine.contentW, height: RULER }} onPointerDown={engine.onScrubPointerDown}>
      {range(minor).map((t) => (
        <div key={`m${t}`} className="absolute bottom-0 h-[3px] w-px bg-border" style={{ left: t * engine.pps }} />
      ))}
      {range(major).map((t) => (
        <span key={t} className="absolute bottom-[3px] translate-x-1 text-[9px] leading-none tabular-nums text-muted-foreground" style={{ left: t * engine.pps }}>
          {shortTime(t)}
        </span>
      ))}
    </div>
  );
}

function TrackHeader({ track, engine }: { track: Track; engine: Engine }) {
  const state = track.muted ? "muted" : track.locked ? "locked" : track.hidden ? "hidden" : null;
  const stateIcon = track.muted ? VolumeOffIcon : track.locked ? LockIcon : track.hidden ? ViewOffIcon : null;
  const item = (icon: typeof ViewIcon, tip: string, on: boolean, onClick: () => void) => (
    <Tooltip content={tip} side="bottom">
      <button type="button" onClick={onClick} className={`grid size-6 place-items-center rounded-sm hover:bg-hover ${on ? "text-foreground" : "text-muted-foreground"}`}>
        <HugeiconsIcon icon={icon} size={13} strokeWidth={1.5} />
      </button>
    </Tooltip>
  );
  return (
    <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-surface-1" style={{ width: HEADER }} onPointerDown={(e) => e.stopPropagation()}>
      <Tooltip content={track.name} side="right">
        <div className={`grid h-full w-full place-items-center ${state ? "text-foreground" : "text-muted-foreground"}`}>
          {stateIcon ? <HugeiconsIcon icon={stateIcon} size={14} strokeWidth={1.5} /> : <KindIcon kind={track.kind} size={14} />}
        </div>
      </Tooltip>
      {/* Hover reveals the controls, laid over the start of the lane. */}
      <div className="pointer-events-none absolute inset-y-0 left-full flex items-center gap-0.5 pl-1 opacity-0 transition-opacity duration-80 group-hover/track:pointer-events-auto group-hover/track:opacity-100">
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface-3 px-1 shadow-surface-3">
          <span className="px-1 text-[11px] text-foreground">{track.name}</span>
          {item(track.muted ? VolumeOffIcon : VolumeHighIcon, "Mute", !!track.muted, () => engine.toggleTrack(track.id, "muted"))}
          {item(track.locked ? LockIcon : LockOpenIcon, "Lock", !!track.locked, () => engine.toggleTrack(track.id, "locked"))}
          {item(track.hidden ? ViewOffIcon : ViewIcon, "Hide", !!track.hidden, () => engine.toggleTrack(track.id, "hidden"))}
        </div>
      </div>
    </div>
  );
}

function Lane({ track, engine }: { track: Track; engine: Engine }) {
  const clips = engine.clips.filter((c) => c.trackId === track.id);
  return (
    <div className={`relative shrink-0 border-b border-border/50 ${track.hidden ? "opacity-30" : ""}`} style={{ width: engine.contentW, height: TRACK }}>
      {clips.map((c) => (
        <ClipView key={c.id} clip={c} track={track} engine={engine} />
      ))}
    </div>
  );
}

function ClipView({ clip, track, engine }: { clip: Clip; track: Track; engine: Engine }) {
  const selected = engine.selected.has(clip.id);
  const dragging = engine.dragId === clip.id;
  const w = clip.duration * engine.pps;
  return (
    <div
      onPointerDown={(e) => engine.onClipPointerDown(e, clip)}
      className={`absolute inset-y-[5px] flex items-center overflow-hidden rounded-[2px] border select-none ${track.locked ? "cursor-not-allowed" : "cursor-grab"} ${dragging ? "z-20" : ""} ${selected ? "border-foreground" : ""}`}
      style={{
        left: clip.start * engine.pps,
        width: Math.max(2, w),
        borderColor: selected ? undefined : clip.tint,
        background: selected ? `color-mix(in srgb, ${clip.tint} 40%, var(--color-surface-1))` : `color-mix(in srgb, ${clip.tint} 14%, var(--color-surface-1))`,
      }}
    >
      <span className="truncate px-1.5 text-[10.5px] leading-none text-foreground/85">{clip.label}</span>
    </div>
  );
}
