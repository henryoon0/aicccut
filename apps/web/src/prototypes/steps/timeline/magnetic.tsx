import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon, PauseIcon, Magnet01Icon, VolumeOffIcon, VolumeHighIcon, LockIcon, LockOpenIcon, ViewIcon, ViewOffIcon, MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button";
import { Tooltip } from "#/components/ui/tooltip";
import type { Clip, Track } from "#/prototypes/mock";
import { EditorFrame, Playhead, SnapLine, Timecode, Waveform, KindIcon, filmstripStyle, shortTime, tickSpec, range, useTimeline, type Engine } from "./shared";

const HEADER = 150;
const RULER = 24;
const PRIMARY = "t-v1";
const H_PRIMARY = 64;
const H_SECONDARY = 34;

export function Magnetic() {
  const engine = useTimeline({ headerW: HEADER, initialPps: 11, magnetic: PRIMARY });
  const above = engine.tracks.filter((t) => t.kind !== "audio" && t.id !== PRIMARY);
  const primary = engine.tracks.find((t) => t.id === PRIMARY)!;
  const below = engine.tracks.filter((t) => t.kind === "audio");

  return (
    <EditorFrame engine={engine} timelineHeight="50%">
      <div className="flex h-full flex-col bg-surface-2">
        <Toolbar engine={engine} />
        <div className="relative min-h-0 flex-1">
          <div ref={engine.scrollRef} className="absolute inset-0 overflow-auto" onPointerDown={engine.clearSelection}>
            <div className="relative" style={{ width: HEADER + engine.contentW, minHeight: "100%" }}>
              <div className="sticky top-0 z-30 flex" style={{ height: RULER }}>
                <div className="sticky left-0 z-10 shrink-0 bg-surface-2" style={{ width: HEADER }} />
                <Ruler engine={engine} />
              </div>
              <div className="flex flex-col gap-px pt-1">
                {above.map((t) => (
                  <Row key={t.id} track={t} engine={engine} height={H_SECONDARY} />
                ))}
              </div>
              <div className="my-2">
                <Row track={primary} engine={engine} height={H_PRIMARY} primary />
              </div>
              <div className="flex flex-col gap-px">
                {below.map((t) => (
                  <Row key={t.id} track={t} engine={engine} height={H_SECONDARY} />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: HEADER, right: 0 }}>
                <SnapLine engine={engine} className="w-px bg-foreground" />
              </div>
            </div>
          </div>
          <Playhead engine={engine} headerW={HEADER} lineClassName="w-0.5 bg-foreground">
            <div className="mt-[6px] size-3 rounded-full border-2 border-surface-2 bg-foreground" />
          </Playhead>
        </div>
      </div>
    </EditorFrame>
  );
}

function Toolbar({ engine }: { engine: Engine }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
      <Button variant="secondary" size="icon-compact" onClick={engine.togglePlay} aria-label="Play">
        <HugeiconsIcon icon={engine.playing ? PauseIcon : PlayIcon} size={14} strokeWidth={1.5} />
      </Button>
      <Timecode store={engine.store} format="short" className="text-[14px] font-medium" />
      <span className="text-[12px] text-muted-foreground">/ 1:38</span>
      <span className="ml-3 rounded-md bg-surface-4 px-2 py-0.5 text-[11px] text-muted-foreground">Main track stays gapless · drag to reorder</span>
      <div className="ml-auto flex items-center gap-1">
        <Tooltip content="Snap to playhead and overlays (N)">
          <Button variant="ghost" size="icon-compact" active={engine.snapOn} onClick={() => engine.setSnapOn(!engine.snapOn)} aria-label="Snapping">
            <HugeiconsIcon icon={Magnet01Icon} size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <Button variant="ghost" size="icon-compact" onClick={() => engine.zoomBy(0.8)} aria-label="Zoom out">
          <HugeiconsIcon icon={MinusSignIcon} size={14} strokeWidth={1.5} />
        </Button>
        <Button variant="ghost" size="icon-compact" onClick={() => engine.zoomBy(1.25)} aria-label="Zoom in">
          <HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}

function Ruler({ engine }: { engine: Engine }) {
  const { major, minor } = tickSpec(engine.pps, 80);
  return (
    <div className="relative shrink-0 cursor-ew-resize select-none bg-surface-2" style={{ width: engine.contentW, height: RULER }} onPointerDown={engine.onScrubPointerDown}>
      {range(minor).map((t) => (
        <div key={`m${t}`} className="absolute bottom-1 h-1 w-px bg-border" style={{ left: t * engine.pps }} />
      ))}
      {range(major).map((t) => (
        <span key={t} className="absolute top-1 -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground" style={{ left: t * engine.pps }}>
          {shortTime(t)}
        </span>
      ))}
    </div>
  );
}

function Row({ track, engine, height, primary }: { track: Track; engine: Engine; height: number; primary?: boolean }) {
  const clips = engine.clips.filter((c) => c.trackId === track.id);
  const btn = (icon: typeof ViewIcon, tip: string, on: boolean, onClick: () => void) => (
    <Tooltip content={tip}>
      <button type="button" onClick={onClick} className={`grid size-5 place-items-center rounded-sm hover:bg-hover ${on ? "text-foreground" : "text-muted-foreground/60"}`}>
        <HugeiconsIcon icon={icon} size={12} strokeWidth={1.5} />
      </button>
    </Tooltip>
  );
  return (
    <div className="flex" style={{ height }}>
      <div className={`sticky left-0 z-20 flex shrink-0 items-center gap-1.5 px-2 ${primary ? "bg-surface-3" : "bg-surface-2"}`} style={{ width: HEADER }} onPointerDown={(e) => e.stopPropagation()}>
        <span className={primary ? "text-foreground" : "text-muted-foreground"}>
          <KindIcon kind={track.kind} size={primary ? 14 : 12} />
        </span>
        <span className={`min-w-0 flex-1 truncate ${primary ? "text-[12px] font-semibold" : "text-[11px] text-muted-foreground"}`}>{primary ? "Main" : track.name}</span>
        <div className="flex shrink-0 items-center">
          {track.kind !== "text" && track.kind !== "effect" && btn(track.muted ? VolumeOffIcon : VolumeHighIcon, "Mute", !!track.muted, () => engine.toggleTrack(track.id, "muted"))}
          {btn(track.locked ? LockIcon : LockOpenIcon, "Lock", !!track.locked, () => engine.toggleTrack(track.id, "locked"))}
          {track.kind !== "audio" && btn(track.hidden ? ViewOffIcon : ViewIcon, "Hide", !!track.hidden, () => engine.toggleTrack(track.id, "hidden"))}
        </div>
      </div>
      <div className={`relative shrink-0 ${primary ? "bg-surface-3 shadow-[inset_0_1px_0_var(--color-border),inset_0_-1px_0_var(--color-border)]" : ""} ${track.hidden ? "opacity-40" : ""} ${track.locked ? "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-hover)_6px_7px)]" : ""}`} style={{ width: engine.contentW, height }}>
        {clips.map((c) => (
          <ClipView key={c.id} clip={c} track={track} engine={engine} height={height} primary={!!primary} />
        ))}
      </div>
    </div>
  );
}

function ClipView({ clip, track, engine, height, primary }: { clip: Clip; track: Track; engine: Engine; height: number; primary: boolean }) {
  const selected = engine.selected.has(clip.id);
  const dragging = engine.dragId === clip.id;
  const w = clip.duration * engine.pps;
  const reflowing = primary && engine.dragId !== null && !dragging;
  if (primary) {
    return (
      <div
        onPointerDown={(e) => engine.onClipPointerDown(e, clip)}
        className={`absolute inset-y-1 overflow-hidden rounded-md select-none ${track.locked ? "cursor-not-allowed" : "cursor-grab"} ${dragging ? "z-20 scale-y-105 opacity-95 shadow-surface-6" : ""} ${reflowing ? "transition-[left] duration-120 ease-out motion-reduce:transition-none" : ""} ${selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface-3" : "ring-1 ring-black/30"}`}
        style={{ left: clip.start * engine.pps, width: Math.max(4, w - 2), ...filmstripStyle(clip.tint, Math.max(28, (height - 8) * (16 / 9))) }}
      >
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/45 px-2 py-1 text-[11px] font-medium text-white">
          <span className="truncate">{clip.label}</span>
          <span className="ml-auto tabular-nums opacity-70">{clip.duration.toFixed(1)}s</span>
        </div>
      </div>
    );
  }
  const isAudio = track.kind === "audio";
  return (
    <div
      onPointerDown={(e) => engine.onClipPointerDown(e, clip)}
      className={`absolute inset-y-[3px] flex items-center overflow-hidden rounded select-none ${track.locked ? "cursor-not-allowed" : "cursor-grab"} ${dragging ? "z-20 shadow-surface-4" : ""} ${selected ? "ring-2 ring-foreground" : ""}`}
      style={{ left: clip.start * engine.pps, width: Math.max(2, w), background: `color-mix(in srgb, ${clip.tint} ${isAudio ? 22 : 55}%, var(--color-surface-4))` }}
    >
      {isAudio && (
        <div className="absolute inset-0 opacity-90">
          <Waveform seed={clip.id.charCodeAt(1) * 23} seconds={clip.duration} color={clip.tint} density={5} />
        </div>
      )}
      <span className={`relative truncate px-1.5 text-[10px] font-medium ${isAudio ? "rounded bg-surface-2/70 py-px text-foreground" : "text-white"}`}>{clip.label}</span>
    </div>
  );
}
