import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  FrameIcon,
  Grid02Icon,
  SkipBackIcon,
  SkipForwardIcon,
} from "@hugeicons/core-free-icons";
import { Slider } from "#/components/ui/slider";
import { Tabs, TabsList, TabItem } from "#/components/ui/tabs";
import { Tooltip } from "#/components/ui/tooltip";
import { Kbd } from "#/components/ui/kbd";
import { cn } from "#/lib/utils";
import { PROJECT_DURATION, timecode } from "#/prototypes/mock";
import { EditorFrame, IconButton, PreviewCanvas, useTextOverlay } from "./shared";
import { TimelineStrip } from "./strip";
import { FRAME, parseTimecode, usePlayback, useTransportKeys, type Playback } from "./playback";

type Zoom = "fit" | 0.5 | 1;

/**
 * Bar — a fixed transport bar under the canvas. Timecode left (click to type
 * a time), transport centred, view options right. Nothing moves, nothing
 * hides; every control has a permanent address.
 */
export function Bar() {
  const pb = usePlayback();
  const ov = useTextOverlay();
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [fit, setFit] = useState(0.4);
  const [safe, setSafe] = useState(false);
  const [grid, setGrid] = useState(false);

  useTransportKeys(pb, (e) => {
    if (e.key === "l" || e.key === "L") {
      pb.setLoop(!pb.loop);
      return true;
    }
    if (e.key === "'" && (e.metaKey || e.ctrlKey)) {
      setSafe((s) => !s);
      return true;
    }
    if (e.key === "g" || e.key === "G") {
      setGrid((g) => !g);
      return true;
    }
  });

  return (
    <EditorFrame ov={ov} time={pb.time} timeline={<TimelineStrip time={pb.time} onSeek={pb.seek} onScrubStart={pb.pause} />}>
      <PreviewCanvas time={pb.time} ov={ov} zoom={zoom} safe={safe} grid={grid} onFit={setFit} />

      {/* Scrub bar spans the full width so the thumb maps 1:1 to the strip below. */}
      <div className="shrink-0 border-t border-border bg-surface-2 px-3 pt-1">
        <Slider
          aria-label="Scrub"
          variant="scrubber"
          value={pb.time}
          onChange={(v) => {
            pb.pause();
            pb.seek(v as number);
          }}
          min={0}
          max={PROJECT_DURATION}
          step={FRAME}
          formatValue={(v) => timecode(v)}
        />
      </div>

      <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-surface-2 px-3">
        <div className="flex items-center gap-1.5 font-mono text-[12px] tabular-nums">
          <EditableTimecode pb={pb} />
          <span className="text-muted-foreground">/ {timecode(PROJECT_DURATION)}</span>
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton
            icon={SkipBackIcon}
            label="Go to start"
            shortcut="Home"
            onClick={() => {
              pb.pause();
              pb.seek(0);
            }}
          />
          <IconButton icon={ArrowLeft01Icon} label="Previous frame" shortcut="←" onClick={() => pb.step(-1)} />
          <IconButton icon={pb.playing ? PauseIcon : PlayIcon} label={pb.playing ? "Pause" : "Play"} shortcut="Space" size="icon" variant="secondary" onClick={pb.toggle} />
          <IconButton icon={ArrowRight01Icon} label="Next frame" shortcut="→" onClick={() => pb.step(1)} />
          <IconButton
            icon={SkipForwardIcon}
            label="Go to end"
            shortcut="End"
            onClick={() => {
              pb.pause();
              pb.seek(PROJECT_DURATION);
            }}
          />
        </div>

        <div className="flex items-center justify-end gap-1">
          <IconButton icon={RepeatIcon} label="Loop" shortcut="L" active={pb.loop} onClick={() => pb.setLoop(!pb.loop)} />
          <IconButton icon={FrameIcon} label="Safe areas" shortcut="⌘'" active={safe} onClick={() => setSafe((s) => !s)} />
          <IconButton icon={Grid02Icon} label="Grid" shortcut="G" active={grid} onClick={() => setGrid((g) => !g)} />
          <span className="mx-1 h-4 w-px bg-border" />
          <Tooltip content={`Zoom · ${zoom === "fit" ? `fit ${Math.round(fit * 100)}%` : `${zoom * 100}%`}`} side="top">
            <div>
              <Tabs size="compact" value={String(zoom)} onValueChange={(v) => setZoom(v === "fit" ? "fit" : (Number(v) as Zoom))}>
                <TabsList aria-label="Zoom">
                  <TabItem value="fit" label="Fit" />
                  <TabItem value="0.5" label="50%" />
                  <TabItem value="1" label="100%" />
                </TabsList>
              </Tabs>
            </div>
          </Tooltip>
        </div>
      </div>
    </EditorFrame>
  );
}

/** Click to type a time; Enter commits, Esc cancels, ↑/↓ nudge a frame. */
function EditableTimecode({ pb }: { pb: Playback }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const t = parseTimecode(draft);
    if (t == null) {
      setInvalid(true);
      return;
    }
    pb.pause();
    pb.seek(t);
    setEditing(false);
    setInvalid(false);
  };

  if (editing) {
    return (
      <input
        ref={input}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(false);
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const t = parseTimecode(draft) ?? pb.time;
            const next = Math.max(0, Math.min(PROJECT_DURATION, t + (e.key === "ArrowUp" ? FRAME : -FRAME)));
            setDraft(timecode(next));
          }
        }}
        aria-label="Current time"
        aria-invalid={invalid}
        className={cn(
          "h-7 w-[112px] rounded-md border bg-surface-3 px-2 font-mono text-[12px] tabular-nums text-foreground outline-none ring-2",
          invalid ? "border-destructive ring-destructive/30" : "border-border ring-foreground/20",
        )}
      />
    );
  }

  return (
    <Tooltip
      side="top"
      content={
        <span className="flex items-center gap-1.5">
          Click to type a time <Kbd>00:00:12.15</Kbd>
        </span>
      }
    >
      <button
        type="button"
        onClick={() => {
          pb.pause();
          setDraft(timecode(pb.time));
          setEditing(true);
        }}
        className="h-7 rounded-md border border-transparent px-2 text-foreground hover:border-border hover:bg-hover focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none"
      >
        {timecode(pb.time)}
      </button>
    </Tooltip>
  );
}
