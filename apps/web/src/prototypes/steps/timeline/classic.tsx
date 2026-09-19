import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Magnet01Icon,
  ArrowShrink01Icon,
  ArrowExpand01Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button";
import { Tooltip } from "#/components/ui/tooltip";
import { Slider } from "#/components/ui/slider";
import type { Clip, Track } from "#/prototypes/mock";
import {
  EditorFrame,
  Playhead,
  SnapLine,
  Timecode,
  Waveform,
  KindIcon,
  filmstripStyle,
  shortTime,
  tickSpec,
  range,
  useTimeline,
  type Engine,
  MIN_PPS,
  MAX_PPS,
} from "./shared";

const HEADER = 208;
const RULER = 28;

export function Classic() {
  const engine = useTimeline({ headerW: HEADER, initialPps: 11 });
  const [tall, setTall] = useState<Set<string>>(() => new Set());
  const [solo, setSolo] = useState<Set<string>>(() => new Set());
  const trackH = (t: Track) => (tall.has(t.id) ? 76 : 44);
  const toggleSet = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };

  return (
    <EditorFrame engine={engine} timelineHeight="48%">
      <div className="flex h-full flex-col bg-surface-2">
        <Toolbar engine={engine} />
        <div className="relative min-h-0 flex-1">
          <div ref={engine.scrollRef} className="absolute inset-0 overflow-auto" onPointerDown={engine.clearSelection}>
            <div className="relative" style={{ width: HEADER + engine.contentW, minHeight: "100%" }}>
              {/* Ruler row */}
              <div className="sticky top-0 z-30 flex" style={{ height: RULER }}>
                <div className="sticky left-0 z-10 flex shrink-0 items-end border-b border-r border-border bg-surface-3 px-2 pb-1 text-[10px] text-muted-foreground" style={{ width: HEADER }}>
                  <span>Tracks</span>
                  <span className="ml-auto tabular-nums">{engine.pps.toFixed(0)} px/s</span>
                </div>
                <Ruler engine={engine} />
              </div>
              {/* Tracks */}
              {engine.tracks.map((t) => (
                <div key={t.id} className="flex border-b border-border/60" style={{ height: trackH(t) }}>
                  <TrackHeader
                    track={t}
                    engine={engine}
                    tall={tall.has(t.id)}
                    solo={solo.has(t.id)}
                    onTall={() => setTall((s) => toggleSet(s, t.id))}
                    onSolo={() => setSolo((s) => toggleSet(s, t.id))}
                  />
                  <Lane track={t} engine={engine} height={trackH(t)} />
                </div>
              ))}
              {/* Snap guide across all lanes */}
              <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: HEADER, right: 0 }}>
                <SnapLine engine={engine} />
              </div>
            </div>
          </div>
          <Playhead engine={engine} headerW={HEADER} lineClassName="w-px bg-destructive">
            <div className="mt-[14px] h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-destructive" />
          </Playhead>
        </div>
      </div>
    </EditorFrame>
  );
}

function Toolbar({ engine }: { engine: Engine }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface-3 px-2">
      <Tooltip content="Go to start (Home)">
        <Button variant="ghost" size="icon-compact" onClick={() => engine.seek(0)} aria-label="Go to start">
          <HugeiconsIcon icon={SkipBackIcon} size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Tooltip content="Play / Pause (Space)">
        <Button variant="secondary" size="icon-compact" onClick={engine.togglePlay} aria-label="Play">
          <HugeiconsIcon icon={engine.playing ? PauseIcon : PlayIcon} size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Tooltip content="Go to end (End)">
        <Button variant="ghost" size="icon-compact" onClick={() => engine.seek(98)} aria-label="Go to end">
          <HugeiconsIcon icon={SkipForwardIcon} size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Timecode store={engine.store} className="ml-2 text-[12px] text-foreground" />
      <span className="text-[11px] text-muted-foreground">/ 00:01:38.00</span>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip content={engine.snapOn ? "Snapping on (N)" : "Snapping off (N)"}>
          <Button variant="ghost" size="icon-compact" active={engine.snapOn} onClick={() => engine.setSnapOn(!engine.snapOn)} aria-label="Toggle snapping">
            <HugeiconsIcon icon={Magnet01Icon} size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <div className="mx-1 h-4 w-px bg-border" />
        <Tooltip content="Zoom out (-)">
          <Button variant="ghost" size="icon-compact" onClick={() => engine.zoomBy(0.8)} aria-label="Zoom out">
            <HugeiconsIcon icon={ArrowShrink01Icon} size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <div className="w-28">
          <Slider size="compact" min={Math.log(MIN_PPS)} max={Math.log(MAX_PPS)} step={0.01} showValue={false} value={Math.log(engine.pps)} onChange={(v) => engine.setZoom(Math.exp(v as number))} aria-label="Zoom" />
        </div>
        <Tooltip content="Zoom in (=)">
          <Button variant="ghost" size="icon-compact" onClick={() => engine.zoomBy(1.25)} aria-label="Zoom in">
            <HugeiconsIcon icon={ArrowExpand01Icon} size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <Button variant="ghost" size="compact" onClick={engine.fit}>
          Fit
        </Button>
      </div>
    </div>
  );
}

function Ruler({ engine }: { engine: Engine }) {
  const { major, minor } = tickSpec(engine.pps);
  return (
    <div className="relative shrink-0 cursor-ew-resize select-none border-b border-border bg-surface-3" style={{ width: engine.contentW, height: RULER }} onPointerDown={engine.onScrubPointerDown}>
      {range(minor).map((t) => (
        <div key={`m${t}`} className="absolute bottom-0 w-px bg-border" style={{ left: t * engine.pps, height: 5 }} />
      ))}
      {range(major).map((t) => (
        <div key={t} className="absolute bottom-0 flex flex-col items-start" style={{ left: t * engine.pps }}>
          <span className="mb-0.5 translate-x-1 text-[10px] tabular-nums text-muted-foreground">{shortTime(t)}</span>
          <div className="h-2.5 w-px bg-muted-foreground" />
        </div>
      ))}
    </div>
  );
}

function TrackHeader({ track, engine, tall, solo, onTall, onSolo }: { track: Track; engine: Engine; tall: boolean; solo: boolean; onTall: () => void; onSolo: () => void }) {
  const chip = (label: string, on: boolean, tip: string, onClick: () => void, cls = "") => (
    <Tooltip content={tip} key={label}>
      <button
        type="button"
        onClick={onClick}
        className={`grid size-5 place-items-center rounded-sm text-[10px] font-semibold transition-colors duration-80 hover:bg-hover focus-visible:ring-1 focus-visible:ring-focus-ring ${on ? cls || "bg-selected text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </button>
    </Tooltip>
  );
  return (
    <div className={`sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-1 border-r border-border bg-surface-3 px-2 ${track.hidden || track.muted ? "opacity-60" : ""}`} style={{ width: HEADER }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">
          <KindIcon kind={track.kind} />
        </span>
        <span className="truncate text-[12px] font-medium">{track.name}</span>
        <div className="ml-auto flex items-center gap-0.5">
          {chip("M", !!track.muted, "Mute", () => engine.toggleTrack(track.id, "muted"), "bg-destructive-light text-destructive")}
          {chip("S", solo, "Solo", onSolo, "bg-selected text-foreground")}
          {chip("L", !!track.locked, "Lock", () => engine.toggleTrack(track.id, "locked"))}
          <Tooltip content={track.hidden ? "Show" : "Hide"}>
            <button type="button" onClick={() => engine.toggleTrack(track.id, "hidden")} className="grid size-5 place-items-center rounded-sm text-muted-foreground hover:bg-hover hover:text-foreground">
              <HugeiconsIcon icon={track.hidden ? ViewOffIcon : ViewIcon} size={12} strokeWidth={1.5} />
            </button>
          </Tooltip>
        </div>
      </div>
      {tall && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{track.kind}</span>
          <span>·</span>
          <span>{engine.clips.filter((c) => c.trackId === track.id).length} clips</span>
        </div>
      )}
      <button type="button" onClick={onTall} className="absolute bottom-0 right-1 text-[9px] leading-none text-muted-foreground hover:text-foreground" aria-label="Toggle track height">
        {tall ? "▴" : "▾"}
      </button>
    </div>
  );
}

function Lane({ track, engine, height }: { track: Track; engine: Engine; height: number }) {
  const clips = engine.clips.filter((c) => c.trackId === track.id);
  return (
    <div className={`relative shrink-0 ${track.locked ? "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-hover)_6px_7px)]" : ""} ${track.hidden ? "opacity-40" : ""}`} style={{ width: engine.contentW, height }}>
      {clips.map((c) => (
        <ClipView key={c.id} clip={c} track={track} engine={engine} height={height} />
      ))}
    </div>
  );
}

function ClipView({ clip, track, engine, height }: { clip: Clip; track: Track; engine: Engine; height: number }) {
  const selected = engine.selected.has(clip.id);
  const dragging = engine.dragId === clip.id;
  const w = clip.duration * engine.pps;
  const isVideo = track.kind === "video";
  const isAudio = track.kind === "audio";
  return (
    <div
      onPointerDown={(e) => engine.onClipPointerDown(e, clip)}
      className={`absolute inset-y-[3px] overflow-hidden rounded-[3px] select-none ${track.locked ? "cursor-not-allowed" : "cursor-grab"} ${dragging ? "z-20 opacity-90 shadow-surface-4" : ""} ${selected ? "ring-2 ring-foreground ring-offset-1 ring-offset-surface-2" : "ring-1 ring-black/40"}`}
      style={{ left: clip.start * engine.pps, width: Math.max(2, w), ...(isVideo ? filmstripStyle(clip.tint, Math.max(24, (height - 6) * (16 / 9))) : { background: `color-mix(in srgb, ${clip.tint} 28%, var(--color-surface-4))` }) }}
    >
      {isAudio && (
        <div className="absolute inset-x-0 bottom-0 top-[14px]">
          <Waveform seed={clip.id.charCodeAt(1) * 31} seconds={clip.duration} color={clip.tint} />
        </div>
      )}
      <div className={`flex h-[14px] items-center gap-1 px-1.5 text-[10px] font-medium leading-none ${isVideo ? "bg-black/45 text-white" : "text-foreground/90"}`} style={isVideo ? undefined : { background: `color-mix(in srgb, ${clip.tint} 45%, transparent)` }}>
        <span className="truncate">{clip.label}</span>
        {w > 140 && <span className="ml-auto tabular-nums opacity-70">{clip.duration.toFixed(1)}s</span>}
      </div>
    </div>
  );
}
