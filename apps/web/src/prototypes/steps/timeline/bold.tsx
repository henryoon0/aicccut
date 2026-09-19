import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon, PauseIcon, Magnet01Icon, VolumeHighIcon, VolumeOffIcon, LockIcon, LockOpenIcon, ViewIcon, ViewOffIcon, MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button";
import { Tooltip } from "#/components/ui/tooltip";
import type { Clip, Track } from "#/prototypes/mock";
import { EditorFrame, Playhead, SnapLine, Timecode, Waveform, KindIcon, shortTime, tickSpec, range, useTimeline, type Engine } from "./shared";

const HEADER = 168;
const RULER = 26;
const TRACK = 68;

export function Bold() {
  const engine = useTimeline({ headerW: HEADER, initialPps: 10 });
  return (
    <EditorFrame engine={engine} timelineHeight="52%">
      <div className="flex h-full flex-col bg-surface-1">
        <Toolbar engine={engine} />
        <div className="relative min-h-0 flex-1">
          <div ref={engine.scrollRef} className="absolute inset-0 overflow-auto" onPointerDown={engine.clearSelection}>
            <div className="relative" style={{ width: HEADER + engine.contentW, minHeight: "100%" }}>
              <div className="sticky top-0 z-30 flex" style={{ height: RULER }}>
                <div className="sticky left-0 z-10 shrink-0 bg-surface-1" style={{ width: HEADER }} />
                <Ruler engine={engine} />
              </div>
              <div className="flex flex-col gap-1.5 py-1.5">
                {engine.tracks.map((t) => (
                  <div key={t.id} className="flex" style={{ height: TRACK }}>
                    <TrackHeader track={t} engine={engine} />
                    <Lane track={t} engine={engine} />
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: HEADER, right: 0 }}>
                <SnapLine engine={engine} className="w-0.5 bg-foreground" />
              </div>
            </div>
          </div>
          <Playhead engine={engine} headerW={HEADER} lineClassName="w-0.5 rounded-full bg-foreground">
            <div className="mt-1 flex items-center rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-semibold text-background shadow-surface-4">
              <Timecode store={engine.store} format="short" />
            </div>
          </Playhead>
        </div>
      </div>
    </EditorFrame>
  );
}

function Toolbar({ engine }: { engine: Engine }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 px-3">
      <Button variant="primary" size="icon" onClick={engine.togglePlay} aria-label="Play" className="rounded-full">
        <HugeiconsIcon icon={engine.playing ? PauseIcon : PlayIcon} size={18} strokeWidth={1.5} />
      </Button>
      <div className="flex items-baseline gap-1.5">
        <Timecode store={engine.store} format="short" className="text-[20px] font-semibold tracking-tight" />
        <span className="text-[13px] text-muted-foreground">/ 1:38</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Tooltip content={engine.snapOn ? "Snap on" : "Snap off"}>
          <Button variant={engine.snapOn ? "secondary" : "ghost"} size="compact" onClick={() => engine.setSnapOn(!engine.snapOn)}>
            <HugeiconsIcon icon={Magnet01Icon} size={14} strokeWidth={1.5} />
            Snap
          </Button>
        </Tooltip>
        <div className="flex items-center rounded-lg bg-surface-3 p-0.5">
          <Button variant="ghost" size="icon-compact" onClick={() => engine.zoomBy(0.75)} aria-label="Zoom out">
            <HugeiconsIcon icon={MinusSignIcon} size={14} strokeWidth={1.5} />
          </Button>
          <button type="button" onClick={engine.fit} className="min-w-12 px-1 text-center text-[11px] tabular-nums text-muted-foreground hover:text-foreground">
            {Math.round((engine.pps / 10) * 100)}%
          </button>
          <Button variant="ghost" size="icon-compact" onClick={() => engine.zoomBy(1.33)} aria-label="Zoom in">
            <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Ruler({ engine }: { engine: Engine }) {
  const { major } = tickSpec(engine.pps, 96);
  return (
    <div className="relative shrink-0 cursor-ew-resize select-none bg-surface-1" style={{ width: engine.contentW, height: RULER }} onPointerDown={engine.onScrubPointerDown}>
      {range(major).map((t) => (
        <div key={t} className="absolute top-1.5 flex items-center gap-1.5" style={{ left: t * engine.pps }}>
          <span className="size-1 rounded-full bg-muted-foreground/60" />
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{shortTime(t)}</span>
        </div>
      ))}
    </div>
  );
}

const KIND_TINT: Record<Track["kind"], string> = {
  video: "#3a86ff",
  audio: "#06d6a0",
  text: "#ffd166",
  effect: "#c77dff",
};

function TrackHeader({ track, engine }: { track: Track; engine: Engine }) {
  const tint = KIND_TINT[track.kind];
  const iconBtn = (icon: typeof ViewIcon, tip: string, on: boolean, onClick: () => void) => (
    <Tooltip content={tip}>
      <button type="button" onClick={onClick} className={`grid size-7 place-items-center rounded-md transition-colors duration-80 hover:bg-hover ${on ? "text-foreground" : "text-muted-foreground/70"}`}>
        <HugeiconsIcon icon={icon} size={15} strokeWidth={1.5} />
      </button>
    </Tooltip>
  );
  return (
    <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2.5 bg-surface-1 pl-3 pr-2" style={{ width: HEADER }} onPointerDown={(e) => e.stopPropagation()}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: tint }}>
        <KindIcon kind={track.kind} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{track.name}</div>
        <div className="mt-1 flex items-center -ml-1.5">
          {iconBtn(track.muted ? VolumeOffIcon : VolumeHighIcon, track.muted ? "Unmute" : "Mute", !!track.muted, () => engine.toggleTrack(track.id, "muted"))}
          {iconBtn(track.locked ? LockIcon : LockOpenIcon, track.locked ? "Unlock" : "Lock", !!track.locked, () => engine.toggleTrack(track.id, "locked"))}
          {iconBtn(track.hidden ? ViewOffIcon : ViewIcon, track.hidden ? "Show" : "Hide", !!track.hidden, () => engine.toggleTrack(track.id, "hidden"))}
        </div>
      </div>
    </div>
  );
}

function Lane({ track, engine }: { track: Track; engine: Engine }) {
  const clips = engine.clips.filter((c) => c.trackId === track.id);
  return (
    <div className={`relative shrink-0 rounded-lg bg-surface-2 ${track.hidden ? "opacity-40" : ""} ${track.locked ? "bg-[repeating-linear-gradient(135deg,transparent_0_8px,var(--color-hover)_8px_10px)]" : ""}`} style={{ width: engine.contentW, height: TRACK }}>
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
  const tint = track.kind === "audio" || track.kind === "video" ? clip.tint : KIND_TINT[track.kind];
  return (
    <div
      onPointerDown={(e) => engine.onClipPointerDown(e, clip)}
      className={`absolute inset-y-1 flex flex-col overflow-hidden rounded-lg select-none text-white transition-[box-shadow] duration-80 ${track.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"} ${dragging ? "z-20 shadow-surface-6" : ""} ${selected ? "ring-[3px] ring-foreground ring-offset-2 ring-offset-surface-2" : ""}`}
      style={{ left: clip.start * engine.pps, width: Math.max(4, w), background: `linear-gradient(180deg, color-mix(in srgb, ${tint} 86%, white), ${tint} 55%, color-mix(in srgb, ${tint} 82%, black))` }}
    >
      <div className="flex items-center gap-1.5 px-2.5 pt-2 text-[13px] font-semibold leading-tight drop-shadow-sm">
        <KindIcon kind={track.kind} size={14} />
        <span className="truncate">{clip.label}</span>
      </div>
      {track.kind === "audio" ? (
        <div className="mx-1 mt-0.5 min-h-0 flex-1 opacity-80">
          <Waveform seed={clip.id.charCodeAt(1) * 17} seconds={clip.duration} color="rgba(255,255,255,.9)" density={5} />
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-1 px-2.5 pb-1.5 text-[11px] font-medium opacity-80">
          <span className="tabular-nums">{clip.duration.toFixed(1)}s</span>
          {w > 160 && track.kind === "video" && <span>· in {clip.inPoint.toFixed(1)}s</span>}
        </div>
      )}
    </div>
  );
}
