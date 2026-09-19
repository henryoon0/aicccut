import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  FrameIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button";
import { DropdownContent, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { Tooltip } from "#/components/ui/tooltip";
import { Kbd } from "#/components/ui/kbd";
import { cn } from "#/lib/utils";
import { PROJECT_DURATION, timecode } from "#/prototypes/mock";
import { EditorFrame, IconButton, PreviewCanvas, useTextOverlay } from "./shared";
import { TimelineStrip } from "./strip";
import { FRAME, clamp, snapFrame, usePlayback, useTransportKeys } from "./playback";

type Zoom = "fit" | 0.5 | 1;
const ZOOMS: Zoom[] = ["fit", 0.5, 1];

/**
 * Minimal — one play button and a timecode. Everything else waits behind
 * "•••". The timecode is the scrubber: drag it sideways, one pixel per frame.
 */
export function Minimal() {
  const pb = usePlayback();
  const ov = useTextOverlay();
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [fit, setFit] = useState(0.4);
  const [safe, setSafe] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const drag = useRef<{ x: number; t: number } | null>(null);

  useTransportKeys(pb, (e) => {
    if (e.key === "l" || e.key === "L") {
      pb.setLoop(!pb.loop);
      return true;
    }
    if (e.key === "'" && (e.metaKey || e.ctrlKey)) {
      setSafe((s) => !s);
      return true;
    }
  });

  const zoomIdx = ZOOMS.indexOf(zoom);
  const checked = [pb.loop ? 2 : -1, safe ? 3 : -1, 4 + zoomIdx].filter((i) => i >= 0);

  return (
    <EditorFrame ov={ov} time={pb.time} timeline={<TimelineStrip time={pb.time} onSeek={pb.seek} onScrubStart={pb.pause} rowHeight={14} />}>
      <PreviewCanvas time={pb.time} ov={ov} zoom={zoom} safe={safe} onFit={setFit} fitPadding={12} />

      <div className="flex h-8 shrink-0 items-center gap-1 bg-surface-1 px-2">
        <IconButton icon={pb.playing ? PauseIcon : PlayIcon} label={pb.playing ? "Pause" : "Play"} shortcut="Space" onClick={pb.toggle} />

        <Tooltip
          side="top"
          content={
            <span className="flex items-center gap-1.5">
              Drag to scrub <Kbd>1px = 1f</Kbd> <Kbd>⇧ ×10</Kbd>
            </span>
          }
        >
          <div
            role="slider"
            tabIndex={0}
            aria-label="Current time"
            aria-valuemin={0}
            aria-valuemax={PROJECT_DURATION}
            aria-valuenow={pb.time}
            aria-valuetext={timecode(pb.time)}
            onPointerDown={(e) => {
              pb.pause();
              drag.current = { x: e.clientX, t: pb.time };
              setScrubbing(true);
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const frames = (e.clientX - d.x) * (e.shiftKey ? 10 : 1);
              pb.seek(clamp(snapFrame(d.t + frames * FRAME), 0, PROJECT_DURATION));
            }}
            onPointerUp={() => {
              drag.current = null;
              setScrubbing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                pb.step((e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 10 : 1));
              }
            }}
            className={cn(
              "flex h-6 cursor-ew-resize select-none items-center rounded-md px-1.5 font-mono text-[12px] tabular-nums outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-foreground/30",
              scrubbing && "bg-active",
            )}
          >
            <span className="text-foreground">{timecode(pb.time)}</span>
            <span className={cn("overflow-hidden whitespace-nowrap text-muted-foreground transition-[max-width,opacity] duration-150 ease-out", scrubbing ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100")}>
              &nbsp;/ {timecode(PROJECT_DURATION)}
            </span>
          </div>
        </Tooltip>

        <div className="ml-auto flex items-center gap-1">
          {pb.loop && <HugeiconsIcon icon={RepeatIcon} size={13} strokeWidth={1.5} className="text-muted-foreground" aria-label="Loop on" />}
          {safe && <HugeiconsIcon icon={FrameIcon} size={13} strokeWidth={1.5} className="text-muted-foreground" aria-label="Safe areas on" />}
          <span className="text-[11px] tabular-nums text-muted-foreground">{zoom === "fit" ? `${Math.round(fit * 100)}%` : `${zoom * 100}%`}</span>
          <DropdownMenu size="compact" open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownTrigger
              render={
                <Button variant="ghost" size="icon-compact" aria-label="More" active={menuOpen}>
                  <HugeiconsIcon icon={MoreHorizontalIcon} size={16} strokeWidth={1.5} />
                </Button>
              }
            />
            <DropdownContent align="end" checkedIndices={checked} className="min-w-[200px]">
              <MenuItem index={0} icon={ArrowIconLeft} label="Previous frame" closeOnClick={false} onSelect={() => pb.step(-1)} />
              <MenuItem index={1} icon={ArrowIconRight} label="Next frame" closeOnClick={false} onSelect={() => pb.step(1)} />
              <DropdownSeparator />
              <MenuItem index={2} label="Loop" checked={pb.loop} onSelect={() => pb.setLoop(!pb.loop)} />
              <MenuItem index={3} label="Safe areas" checked={safe} onSelect={() => setSafe((s) => !s)} />
              <DropdownSeparator />
              <DropdownLabel>Zoom</DropdownLabel>
              <MenuItem index={4} label={`Fit · ${Math.round(fit * 100)}%`} checked={zoom === "fit"} onSelect={() => setZoom("fit")} />
              <MenuItem index={5} label="50%" checked={zoom === 0.5} onSelect={() => setZoom(0.5)} />
              <MenuItem index={6} label="100%" checked={zoom === 1} onSelect={() => setZoom(1)} />
            </DropdownContent>
          </DropdownMenu>
        </div>
      </div>
    </EditorFrame>
  );
}

// MenuItem takes a component-style icon; adapt the hugeicons svg data.
function ArrowIconLeft({ className }: { className?: string }) {
  return <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={1.5} className={className} />;
}
function ArrowIconRight({ className }: { className?: string }) {
  return <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.5} className={className} />;
}
