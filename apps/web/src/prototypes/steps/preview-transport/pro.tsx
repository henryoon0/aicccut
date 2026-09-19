import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BookmarkAdd01Icon,
  FrameIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Tooltip } from "#/components/ui/tooltip";
import { Kbd } from "#/components/ui/kbd";
import { DropdownContent, DropdownMenu, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { cn } from "#/lib/utils";
import { PROJECT_DURATION, timecode } from "#/prototypes/mock";
import { EditorFrame, IconButton, PreviewCanvas, useTextOverlay } from "./shared";
import { TimelineStrip } from "./strip";
import { FPS, audioLevel, clamp, snapFrame, usePlayback, useTransportKeys, type Playback } from "./playback";

type Zoom = "fit" | 0.5 | 1;
const ZOOMS: { v: Zoom; label: string; key: string }[] = [
  { v: "fit", label: "Fit", key: "⇧0" },
  { v: 0.5, label: "50%", key: "⇧5" },
  { v: 1, label: "100%", key: "⇧1" },
];

/**
 * Pro — the NLE grammar: JKL shuttle with a speed badge, In/Out marks on a
 * mini scrub bar, bookmarks, a frame-accurate stepper and an audio meter.
 * Dense, keyboard-first, every state visible.
 */
export function Pro() {
  const pb = usePlayback();
  const ov = useTextOverlay();
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [fit, setFit] = useState(0.4);
  const [safe, setSafe] = useState(false);
  const [bookmarks, setBookmarks] = useState<number[]>([8.5, 41.2]);

  const shuttle = (dir: -1 | 1) => {
    const r = pb.rate;
    if (Math.sign(r) === dir) pb.play(clamp(r * 2, -4, 4));
    else pb.play(dir);
  };
  const mark = () => setBookmarks((b) => (b.some((x) => Math.abs(x - pb.time) < 0.05) ? b.filter((x) => Math.abs(x - pb.time) >= 0.05) : [...b, snapFrame(pb.time)].sort((a, c) => a - c)));

  useTransportKeys(pb, (e) => {
    const k = e.key.toLowerCase();
    if (k === "j") return (shuttle(-1), true);
    if (k === "l") return (shuttle(1), true);
    if (k === "k") return (pb.pause(), true);
    if (k === "i") return (e.shiftKey ? pb.setIn(null) : pb.setIn(snapFrame(pb.time)), true);
    if (k === "o") return (e.shiftKey ? pb.setOut(null) : pb.setOut(snapFrame(pb.time)), true);
    if (k === "b") return (mark(), true);
    if (e.key === "'" && (e.metaKey || e.ctrlKey)) return (setSafe((s) => !s), true);
    if (e.shiftKey && e.key === ")") return (setZoom("fit"), true);
    if (e.shiftKey && e.key === "%") return (setZoom(0.5), true);
    if (e.shiftKey && e.key === "!") return (setZoom(1), true);
  });

  const frame = Math.round(pb.time * FPS);
  const speed = Math.abs(pb.rate);

  return (
    <EditorFrame
      ov={ov}
      time={pb.time}
      timeline={<TimelineStrip time={pb.time} onSeek={pb.seek} onScrubStart={pb.pause} inPoint={pb.inPoint} outPoint={pb.outPoint} bookmarks={bookmarks} />}
    >
      <div className="flex min-h-0 flex-1">
        <PreviewCanvas time={pb.time} ov={ov} zoom={zoom} safe={safe} onFit={setFit} fitPadding={20}>
          {pb.playing && speed !== 1 && (
            <Badge color={pb.rate < 0 ? "amber" : "blue"} size="compact" className="absolute left-3 top-3 font-mono tabular-nums">
              {pb.rate < 0 ? "◂" : "▸"} {speed}×
            </Badge>
          )}
        </PreviewCanvas>
        <Meters pb={pb} />
      </div>

      <ScrubBar pb={pb} bookmarks={bookmarks} />

      <div className="flex h-12 shrink-0 items-center gap-1 bg-surface-2 px-3">
        {/* Shuttle */}
        <div className="flex items-center gap-0.5 rounded-lg bg-surface-3 p-0.5">
          <ShuttleKey label="J" hint="Reverse · press again 2×/4×" active={pb.rate < 0} onClick={() => shuttle(-1)} />
          <ShuttleKey label="K" hint="Stop" active={!pb.playing} onClick={pb.pause} />
          <ShuttleKey label="L" hint="Forward · press again 2×/4×" active={pb.rate > 0} onClick={() => shuttle(1)} />
        </div>
        <IconButton icon={pb.playing ? PauseIcon : PlayIcon} label={pb.playing ? "Pause" : "Play"} shortcut="Space" size="icon" variant="secondary" onClick={pb.toggle} />
        <IconButton icon={RepeatIcon} label="Loop in → out" shortcut="⌥L" active={pb.loop} onClick={() => pb.setLoop(!pb.loop)} />

        <span className="mx-1.5 h-5 w-px bg-border" />

        {/* In / Out */}
        <MarkButton label="In" shortcut="I" value={pb.inPoint} onSet={() => pb.setIn(snapFrame(pb.time))} onClear={() => pb.setIn(null)} onJump={(t) => pb.seek(t)} />
        <MarkButton label="Out" shortcut="O" value={pb.outPoint} onSet={() => pb.setOut(snapFrame(pb.time))} onClear={() => pb.setOut(null)} onJump={(t) => pb.seek(t)} />
        <IconButton icon={BookmarkAdd01Icon} label={bookmarks.some((b) => Math.abs(b - pb.time) < 0.05) ? "Remove bookmark" : "Add bookmark"} shortcut="B" active={bookmarks.some((b) => Math.abs(b - pb.time) < 0.05)} onClick={mark} />

        <span className="mx-1.5 h-5 w-px bg-border" />

        {/* Frame stepper */}
        <div className="flex items-center gap-0.5">
          <IconButton icon={ArrowLeft01Icon} label="Previous frame" shortcut="←" onClick={() => pb.step(-1)} />
          <FrameInput frame={frame} onCommit={(f) => { pb.pause(); pb.seek(f / FPS); }} />
          <IconButton icon={ArrowRight01Icon} label="Next frame" shortcut="→" onClick={() => pb.step(1)} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[15px] tabular-nums tracking-tight text-foreground">{timecode(pb.time)}</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">/ {timecode(PROJECT_DURATION)}</span>
          <span className="mx-1 h-5 w-px bg-border" />
          <IconButton icon={FrameIcon} label="Safe areas" shortcut="⌘'" active={safe} onClick={() => setSafe((s) => !s)} />
          <DropdownMenu size="compact">
            <DropdownTrigger
              render={
                <Button variant="ghost" size="compact" className="w-[76px] justify-between gap-1.5 tabular-nums">
                  {zoom === "fit" ? `${Math.round(fit * 100)}%` : `${zoom * 100}%`}
                  <span className="text-[10px] text-muted-foreground">{zoom === "fit" ? "FIT" : ""}</span>
                </Button>
              }
            />
            <DropdownContent align="end" checkedIndex={ZOOMS.findIndex((z) => z.v === zoom)} className="min-w-[140px]">
              {ZOOMS.map((z, i) => (
                <MenuItem key={z.label} index={i} label={`${z.label}   ${z.key}`} checked={zoom === z.v} onSelect={() => setZoom(z.v)} />
              ))}
            </DropdownContent>
          </DropdownMenu>
        </div>
      </div>
    </EditorFrame>
  );
}

function ShuttleKey({ label, hint, active, onClick }: { label: string; hint: string; active: boolean; onClick: () => void }) {
  return (
    <Tooltip side="top" content={<span className="flex items-center gap-1.5">{hint}<Kbd>{label}</Kbd></span>}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "h-6 w-7 rounded-md font-mono text-[12px] font-semibold transition-colors duration-100 hover:bg-hover focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none",
          active ? "bg-foreground text-background hover:bg-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </button>
    </Tooltip>
  );
}

interface MarkButtonProps {
  label: string;
  shortcut: string;
  value: number | null;
  onSet: () => void;
  onClear: () => void;
  onJump: (t: number) => void;
}

function MarkButton({ label, shortcut, value, onSet, onClear, onJump }: MarkButtonProps) {
  return (
    <div className="flex items-center">
      <Tooltip side="top" content={<span className="flex items-center gap-1.5">{value == null ? `Mark ${label}` : `Jump to ${label}`}<Kbd>{shortcut}</Kbd></span>}>
        <button
          type="button"
          onClick={() => (value == null ? onSet() : onJump(value))}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md px-2 font-mono text-[11px] tabular-nums hover:bg-hover focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none",
            value == null ? "text-muted-foreground" : "text-foreground",
            value != null && "rounded-r-none",
          )}
        >
          <span className="grid size-4 place-items-center rounded-[3px] bg-surface-3 text-[10px] font-semibold">{label[0]}</span>
          {value == null ? "—" : timecode(value)}
        </button>
      </Tooltip>
      {value != null && (
        <Tooltip side="top" content={<span className="flex items-center gap-1.5">Clear {label}<Kbd>⇧{shortcut}</Kbd></span>}>
          <button type="button" onClick={onClear} aria-label={`Clear ${label}`} className="grid h-7 w-5 place-items-center rounded-r-md text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none">
            <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={1.75} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function FrameInput({ frame, onCommit }: { frame: number; onCommit: (f: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Tooltip side="top" content="Frame number · type to jump">
      <input
        value={draft ?? String(frame)}
        onFocus={(e) => { setDraft(String(frame)); e.currentTarget.select(); }}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const f = Number(draft);
            if (Number.isFinite(f)) onCommit(clamp(f, 0, PROJECT_DURATION * FPS));
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") (e.currentTarget as HTMLInputElement).blur();
        }}
        aria-label="Frame"
        inputMode="numeric"
        className="h-7 w-[64px] rounded-md border border-transparent bg-surface-3 px-2 text-center font-mono text-[12px] tabular-nums text-foreground outline-none hover:border-border focus:border-border focus:ring-2 focus:ring-foreground/20"
      />
    </Tooltip>
  );
}

/** Mini scrub bar with in/out range and bookmark ticks. */
function ScrubBar({ pb, bookmarks }: { pb: Playback; bookmarks: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(t / PROJECT_DURATION) * 100}%`;
  const seek = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    pb.seek(clamp(((e.clientX - r.left) / r.width) * PROJECT_DURATION, 0, PROJECT_DURATION));
  };
  const lo = pb.inPoint ?? 0;
  const hi = pb.outPoint ?? PROJECT_DURATION;
  return (
    <div className="shrink-0 border-t border-border bg-surface-2 px-3 pt-2">
      <div
        ref={ref}
        role="slider"
        aria-label="Scrub"
        aria-valuemin={0}
        aria-valuemax={PROJECT_DURATION}
        aria-valuenow={pb.time}
        tabIndex={-1}
        className="relative h-4 cursor-ew-resize touch-none select-none"
        onPointerDown={(e) => { pb.pause(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); seek(e); }}
        onPointerMove={(e) => { if (e.buttons & 1) seek(e); }}
      >
        <div className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-surface-4" />
        <div className="absolute top-1.5 h-1 rounded-full bg-foreground/70" style={{ left: pct(lo), width: pct(hi - lo) }} />
        {pb.inPoint != null && <span className="absolute top-0 h-4 w-[3px] -translate-x-1/2 rounded-[1px] bg-foreground" style={{ left: pct(pb.inPoint) }} />}
        {pb.outPoint != null && <span className="absolute top-0 h-4 w-[3px] -translate-x-1/2 rounded-[1px] bg-foreground" style={{ left: pct(pb.outPoint) }} />}
        {bookmarks.map((b) => (
          <span key={b} className="absolute top-[3px] size-2 -translate-x-1/2 rotate-45 rounded-[1px] bg-amber-500" style={{ left: pct(b) }} />
        ))}
        <span className="absolute top-0 h-4 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: pct(pb.time) }}>
          <span className="absolute -left-[3px] -top-px size-2 rounded-full bg-foreground" />
        </span>
      </div>
    </div>
  );
}

/** Two-channel meter, peak hold, dBFS-ish scale. */
function Meters({ pb }: { pb: Playback }) {
  const peaks = useRef([0, 0]);
  const [, force] = useState(0);
  const l = audioLevel(pb.time, pb.playing, 0);
  const r = audioLevel(pb.time, pb.playing, 1);
  useEffect(() => {
    peaks.current = [Math.max(l, peaks.current[0] * 0.985), Math.max(r, peaks.current[1] * 0.985)];
    if (!pb.playing && (peaks.current[0] > 0.01 || peaks.current[1] > 0.01)) {
      const id = requestAnimationFrame(() => force((n) => n + 1));
      return () => cancelAnimationFrame(id);
    }
  });
  const marks = ["0", "-6", "-12", "-24", "-48"];
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-l border-border bg-surface-2 py-3" aria-label="Audio meter">
      <div className="flex min-h-0 flex-1 gap-1">
        {[l, r].map((v, i) => (
          <div key={i} className="relative w-2.5 overflow-hidden rounded-[3px] bg-surface-4">
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: `${v * 100}%`,
                background: "linear-gradient(to top, #22c55e 0%, #22c55e 65%, #eab308 80%, #ef4444 100%)",
                backgroundSize: "100% 400%",
                backgroundPosition: "bottom",
              }}
            />
            <div className="absolute inset-x-0 h-0.5 bg-foreground" style={{ bottom: `${peaks.current[i] * 100}%` }} />
          </div>
        ))}
        <div className="flex flex-col justify-between font-mono text-[8px] tabular-nums text-muted-foreground">
          {marks.map((m) => <span key={m}>{m}</span>)}
        </div>
      </div>
      <span className="text-[9px] font-medium text-muted-foreground">L R</span>
    </div>
  );
}
