import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  FrameIcon,
  ZoomInAreaIcon,
} from "@hugeicons/core-free-icons";
import { Slider } from "#/components/ui/slider";
import { DropdownContent, DropdownMenu, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { Button } from "#/components/ui/button";
import { Elevated } from "#/lib/elevated";
import { spring } from "#/lib/springs";
import { PROJECT_DURATION, timecode } from "#/prototypes/mock";
import { EditorFrame, IconButton, PreviewCanvas, glass, useTextOverlay } from "./shared";
import { TimelineStrip } from "./strip";
import { FRAME, usePlayback, useTransportKeys } from "./playback";

type Zoom = "fit" | 0.5 | 1;
const ZOOMS: { v: Zoom; label: string }[] = [
  { v: "fit", label: "Fit" },
  { v: 0.5, label: "50%" },
  { v: 1, label: "100%" },
];

/**
 * Floating — controls live on top of the picture. They appear on pointer
 * movement and fade out after 2 s of stillness while playing. Timecode top
 * left, zoom top right, transport bottom centre, all translucent.
 */
export function Floating() {
  const pb = usePlayback();
  const ov = useTextOverlay();
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [fit, setFit] = useState(0.4);
  const [safe, setSafe] = useState(false);
  const [visible, setVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const idle = useRef<number>(0);
  const hovering = useRef(false);

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

  const arm = useCallback(() => {
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => {
      if (!hovering.current) setVisible(false);
    }, 2000);
  }, []);

  const wake = useCallback(() => {
    setVisible(true);
    if (pb.playing) arm();
  }, [arm, pb.playing]);

  // Playing: start the idle timer. Paused: controls stay.
  useEffect(() => {
    if (pb.playing) arm();
    else {
      window.clearTimeout(idle.current);
      setVisible(true);
    }
    return () => window.clearTimeout(idle.current);
  }, [pb.playing, arm]);

  const shown = visible || menuOpen;
  const zoomLabel = zoom === "fit" ? `Fit · ${Math.round(fit * 100)}%` : `${zoom * 100}%`;

  return (
    <EditorFrame
      ov={ov}
      time={pb.time}
      timeline={<TimelineStrip time={pb.time} onSeek={pb.seek} onScrubStart={pb.pause} />}
    >
      <PreviewCanvas
        time={pb.time}
        ov={ov}
        zoom={zoom}
        safe={safe}
        onFit={setFit}
        fitPadding={16}
        containerProps={{
          onPointerMove: wake,
          onPointerLeave: () => {
            if (pb.playing) setVisible(false);
          },
          className: pb.playing && !shown ? "cursor-none" : undefined,
        }}
      >
        <AnimatePresence initial={false}>
          {shown && (
            <>
              {/* Timecode — top left */}
              <motion.div
                key="tc"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={spring.moderate}
                className="pointer-events-none absolute left-3 top-3"
              >
                <Elevated offset={2} className="rounded-md px-2 py-1 font-mono text-[12px] tabular-nums opacity-90" style={glass}>
                  <span className="text-foreground">{timecode(pb.time)}</span>
                  <span className="text-muted-foreground"> / {timecode(PROJECT_DURATION)}</span>
                </Elevated>
              </motion.div>

              {/* Zoom + guides — top right */}
              <motion.div
                key="zoom"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={spring.moderate}
                className="absolute right-3 top-3"
                onPointerEnter={() => (hovering.current = true)}
                onPointerLeave={() => (hovering.current = false)}
              >
                <Elevated offset={2} className="flex items-center gap-0.5 rounded-md p-0.5 opacity-90" style={glass}>
                  <IconButton icon={FrameIcon} label="Safe areas" shortcut="⌘'" active={safe} onClick={() => setSafe((s) => !s)} side="bottom" />
                  <DropdownMenu size="compact" open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownTrigger
                      render={
                        <Button variant="ghost" size="compact" className="gap-1.5 tabular-nums" active={menuOpen}>
                          <HugeiconsIcon icon={ZoomInAreaIcon} size={14} strokeWidth={1.5} />
                          {zoomLabel}
                        </Button>
                      }
                    />
                    <DropdownContent align="end" sideOffset={6} checkedIndex={ZOOMS.findIndex((z) => z.v === zoom)}>
                      {ZOOMS.map((z, i) => (
                        <MenuItem key={z.label} index={i} label={z.label} checked={zoom === z.v} onSelect={() => setZoom(z.v)} />
                      ))}
                    </DropdownContent>
                  </DropdownMenu>
                </Elevated>
              </motion.div>

              {/* Transport — bottom centre */}
              <motion.div
                key="transport"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={spring.moderate}
                className="absolute inset-x-0 bottom-3 flex justify-center"
                onPointerEnter={() => (hovering.current = true)}
                onPointerLeave={() => (hovering.current = false)}
              >
                <Elevated offset={2} className="flex w-[min(560px,calc(100%-24px))] flex-col gap-1 rounded-xl px-3 pb-1.5 pt-2 opacity-95" style={glass}>
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
                  <div className="flex items-center justify-center gap-1">
                    <IconButton icon={ArrowLeft01Icon} label="Previous frame" shortcut="←" onClick={() => pb.step(-1)} />
                    <IconButton icon={pb.playing ? PauseIcon : PlayIcon} label={pb.playing ? "Pause" : "Play"} shortcut="Space" size="icon" variant="secondary" onClick={pb.toggle} />
                    <IconButton icon={ArrowRight01Icon} label="Next frame" shortcut="→" onClick={() => pb.step(1)} />
                    <span className="mx-1 h-4 w-px bg-border" />
                    <IconButton icon={RepeatIcon} label="Loop" shortcut="L" active={pb.loop} onClick={() => pb.setLoop(!pb.loop)} />
                  </div>
                </Elevated>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </PreviewCanvas>
    </EditorFrame>
  );
}
