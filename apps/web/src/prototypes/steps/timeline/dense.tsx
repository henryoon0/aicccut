import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Magnet01Icon, Bookmark01Icon } from "@hugeicons/core-free-icons";
import { Kbd } from "#/components/ui/kbd";
import { Tooltip } from "#/components/ui/tooltip";
import { timecode, type Clip, type Track } from "#/prototypes/mock";
import { EditorFrame, Playhead, SnapLine, Timecode, Waveform, KindIcon, tickSpec, range, useTimeline, mulberry, FPS, DUR, type Engine, type TimeStore } from "./shared";

const HEADER = 172;
const MARKERS = 14;
const RULER = 22;
const TRACK = 28;

export function Dense() {
  const engine = useTimeline({ headerW: HEADER, initialPps: 14 });
  return (
    <EditorFrame engine={engine} timelineHeight="46%">
      <div className="flex h-full flex-col bg-surface-1 text-[10px]">
        <div className="relative min-h-0 flex-1">
          <div ref={engine.scrollRef} className="absolute inset-0 overflow-auto" onPointerDown={engine.clearSelection}>
            <div className="relative" style={{ width: HEADER + engine.contentW, minHeight: "100%" }}>
              <div className="sticky top-0 z-30 flex flex-col">
                <div className="flex" style={{ height: MARKERS }}>
                  <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-b border-r border-border bg-surface-2 px-1.5 text-muted-foreground" style={{ width: HEADER }}>
                    <HugeiconsIcon icon={Bookmark01Icon} size={10} strokeWidth={1.5} />
                    <span>Markers</span>
                    <span className="ml-auto tabular-nums">{engine.markers.length}</span>
                  </div>
                  <MarkerLane engine={engine} />
                </div>
                <div className="flex" style={{ height: RULER }}>
                  <div className="sticky left-0 z-10 flex shrink-0 items-center border-b border-r border-border bg-surface-2 px-1.5 text-muted-foreground" style={{ width: HEADER }}>
                    <Timecode store={engine.store} className="text-[11px] text-foreground" />
                    <span className="ml-auto tabular-nums">{engine.pps >= FPS * 4 ? "frames" : `${engine.pps.toFixed(0)} px/s`}</span>
                  </div>
                  <Ruler engine={engine} />
                </div>
              </div>
              {engine.tracks.map((t) => (
                <div key={t.id} className="flex border-b border-border/70" style={{ height: TRACK }}>
                  <TrackHeader track={t} engine={engine} />
                  <Lane track={t} engine={engine} />
                </div>
              ))}
              <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: HEADER, right: 0 }}>
                <SnapLine engine={engine} className="w-px bg-focus-ring" />
              </div>
            </div>
          </div>
          <Playhead engine={engine} headerW={HEADER} lineClassName="w-px bg-destructive">
            <div className="mt-[14px] h-2 w-[7px] rounded-b-[2px] bg-destructive" />
          </Playhead>
        </div>
        <StatusBar engine={engine} />
      </div>
    </EditorFrame>
  );
}

function StatusBar({ engine }: { engine: Engine }) {
  const key = (k: string, label: string) => (
    <span className="flex items-center gap-1 text-muted-foreground">
      <Kbd className="h-4 min-w-4 text-[9px]">{k}</Kbd>
      {label}
    </span>
  );
  return (
    <div className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-surface-2 px-2">
      <span className={`tabular-nums ${engine.playing ? "text-foreground" : "text-muted-foreground"}`}>{engine.playing ? `▶ ${engine.rate > 0 ? "" : "−"}${Math.abs(engine.rate)}×` : "■ stopped"}</span>
      <div className="h-3 w-px bg-border" />
      {key("J", "rev")}
      {key("K", "stop")}
      {key("L", "fwd")}
      {key("Space", "play")}
      {key(", .", "frame")}
      {key("B", "marker")}
      {key("N", engine.snapOn ? "snap on" : "snap off")}
      {key("+ / −", "zoom")}
      {key("⇧Z", "fit")}
      <span className="ml-auto text-muted-foreground">
        {engine.selected.size > 0 ? `${engine.selected.size} selected · ⌫ delete` : `${engine.clips.length} clips · ${timecode(DUR, FPS)}`}
      </span>
      <Tooltip content="Snapping (N)">
        <button type="button" onClick={() => engine.setSnapOn(!engine.snapOn)} className={`grid size-5 place-items-center rounded-sm hover:bg-hover ${engine.snapOn ? "text-foreground" : "text-muted-foreground/50"}`} aria-label="Snapping">
          <HugeiconsIcon icon={Magnet01Icon} size={11} strokeWidth={1.5} />
        </button>
      </Tooltip>
    </div>
  );
}

function MarkerLane({ engine }: { engine: Engine }) {
  return (
    <div className="relative shrink-0 border-b border-border bg-surface-2" style={{ width: engine.contentW, height: MARKERS }} onPointerDown={engine.onScrubPointerDown}>
      {engine.markers.map((m, i) => (
        <Tooltip key={m} content={`Marker ${i + 1} · ${timecode(m, FPS)}`} side="bottom">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => engine.seek(m)}
            className="absolute top-[2px] h-[10px] w-[8px] -translate-x-1/2 rounded-b-[3px] rounded-t-[1px] bg-focus-ring hover:brightness-125"
            style={{ left: m * engine.pps }}
            aria-label={`Marker ${i + 1}`}
          />
        </Tooltip>
      ))}
    </div>
  );
}

function Ruler({ engine }: { engine: Engine }) {
  const framePx = engine.pps / FPS;
  const frames = framePx >= 5;
  const { major, minor } = frames ? { major: 1, minor: 1 / FPS } : tickSpec(engine.pps, 90);
  return (
    <div className="relative shrink-0 cursor-ew-resize select-none border-b border-border bg-surface-2" style={{ width: engine.contentW, height: RULER }} onPointerDown={engine.onScrubPointerDown}>
      {range(minor).map((t, i) => (
        <div key={`m${i}`} className={`absolute bottom-0 w-px ${frames && i % 5 === 0 ? "h-2 bg-muted-foreground/70" : "h-1 bg-border"}`} style={{ left: t * engine.pps }}>
          {frames && framePx >= 13 && i % FPS !== 0 && <span className="absolute -top-2.5 left-0.5 text-[8px] tabular-nums text-muted-foreground/70">{i % FPS}</span>}
        </div>
      ))}
      {range(major).map((t) => (
        <div key={t} className="absolute bottom-0 h-3 w-px bg-muted-foreground" style={{ left: t * engine.pps }}>
          <span className="absolute -top-[13px] left-1 whitespace-nowrap text-[9.5px] tabular-nums text-foreground/90">{timecode(t, FPS).slice(3).replace(".", ":")}</span>
        </div>
      ))}
    </div>
  );
}

function Meter({ store, playing, seed }: { store: TimeStore; playing: boolean; seed: number }) {
  const l = useRef<HTMLDivElement>(null);
  const r = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!playing) {
      if (l.current) l.current.style.transform = "scaleY(0)";
      if (r.current) r.current.style.transform = "scaleY(0)";
      return;
    }
    const rnd = mulberry(seed);
    return store.subscribe((t) => {
      const base = 0.45 + 0.35 * Math.sin(t * 2.3 + seed) * Math.sin(t * 0.7);
      if (l.current) l.current.style.transform = `scaleY(${Math.min(1, Math.max(0.05, base + rnd() * 0.3))})`;
      if (r.current) r.current.style.transform = `scaleY(${Math.min(1, Math.max(0.05, base + rnd() * 0.3 - 0.05))})`;
    });
  }, [store, playing, seed]);
  const bar = "h-full w-[3px] origin-bottom rounded-[1px] bg-[linear-gradient(0deg,#06d6a0_0_70%,#ffd166_70%_90%,#ef476f_90%)]";
  return (
    <div className="flex h-4 items-end gap-px rounded-[2px] bg-surface-1 px-px">
      <div className="h-full w-[3px] overflow-hidden">
        <div ref={l} className={bar} style={{ transform: "scaleY(0)" }} />
      </div>
      <div className="h-full w-[3px] overflow-hidden">
        <div ref={r} className={bar} style={{ transform: "scaleY(0)" }} />
      </div>
    </div>
  );
}

function TrackHeader({ track, engine }: { track: Track; engine: Engine }) {
  const tog = (label: string, on: boolean, tip: string, onClick: () => void, onCls: string) => (
    <Tooltip content={tip} key={label}>
      <button type="button" onClick={onClick} className={`grid h-4 w-4 place-items-center rounded-[2px] text-[9px] font-semibold leading-none transition-colors duration-80 hover:bg-hover ${on ? onCls : "text-muted-foreground/60"}`}>
        {label}
      </button>
    </Tooltip>
  );
  const active = !track.muted && !track.hidden;
  return (
    <div className={`sticky left-0 z-20 flex shrink-0 items-center gap-1 border-r border-border bg-surface-2 px-1.5 ${active ? "" : "opacity-60"}`} style={{ width: HEADER }} onPointerDown={(e) => e.stopPropagation()}>
      <span className="text-muted-foreground">
        <KindIcon kind={track.kind} size={11} />
      </span>
      <span className="w-[52px] truncate text-[10.5px] font-medium">{track.name}</span>
      <div className="flex items-center gap-px">
        {tog("M", !!track.muted, "Mute", () => engine.toggleTrack(track.id, "muted"), "bg-destructive-light text-destructive")}
        {tog("L", !!track.locked, "Lock", () => engine.toggleTrack(track.id, "locked"), "bg-selected text-foreground")}
        {tog("V", !track.hidden, track.hidden ? "Show" : "Hide", () => engine.toggleTrack(track.id, "hidden"), "text-foreground")}
      </div>
      <div className="ml-auto">{track.kind === "audio" || track.kind === "video" ? <Meter store={engine.store} playing={engine.playing && !track.muted} seed={track.id.length * 7 + track.name.charCodeAt(0)} /> : null}</div>
    </div>
  );
}

function Lane({ track, engine }: { track: Track; engine: Engine }) {
  const clips = engine.clips.filter((c) => c.trackId === track.id);
  return (
    <div className={`relative shrink-0 ${track.hidden ? "opacity-40" : ""} ${track.locked ? "bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--color-hover)_5px_6px)]" : ""}`} style={{ width: engine.contentW, height: TRACK }}>
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
  const isAudio = track.kind === "audio";
  return (
    <div
      onPointerDown={(e) => engine.onClipPointerDown(e, clip)}
      className={`absolute inset-y-[2px] overflow-hidden rounded-[2px] border select-none ${track.locked ? "cursor-not-allowed" : "cursor-grab"} ${dragging ? "z-20 shadow-surface-3" : ""} ${selected ? "border-foreground" : ""}`}
      style={{
        left: clip.start * engine.pps,
        width: Math.max(2, w),
        borderColor: selected ? undefined : `color-mix(in srgb, ${clip.tint} 70%, var(--color-surface-1))`,
        background: `color-mix(in srgb, ${clip.tint} ${selected ? 38 : 24}%, var(--color-surface-1))`,
      }}
    >
      {isAudio && (
        <div className="absolute inset-x-0 bottom-0 top-[11px]">
          <Waveform seed={clip.id.charCodeAt(1) * 13} seconds={clip.duration} color={clip.tint} density={8} />
        </div>
      )}
      <div className="flex h-[11px] items-center gap-1 px-1 font-mono text-[9px] leading-none text-foreground/90">
        <span className="truncate">{clip.label}</span>
        {w > 120 && <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{timecode(clip.duration, FPS).slice(3)}</span>}
      </div>
    </div>
  );
}
