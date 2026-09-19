import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cursor01Icon,
  FrameIcon,
  Grid02Icon,
  HandGrabIcon,
  PauseIcon,
  PlayIcon,
  RulerIcon,
} from "@hugeicons/core-free-icons";
import { Tabs, TabsList, TabItem } from "#/components/ui/tabs";
import { Elevated } from "#/lib/elevated";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { PROJECT_DURATION, timecode } from "#/prototypes/mock";
import { EditorFrame, IconButton, PreviewCanvas, glass, useTextOverlay } from "./shared";
import { TimelineStrip } from "./strip";
import { CANVAS_H, CANVAS_W, clamp, usePlayback, useTransportKeys } from "./playback";

const MIN = 0.1;
const MAX = 4;
const RULER = 18;

/**
 * Spatial — the canvas is a viewport. Pinch/wheel zoom about the cursor,
 * space-drag or hand tool to pan, rulers in project pixels. Transport is a
 * compact pill; view tools live in a side rail.
 */
export function Spatial() {
  const pb = usePlayback();
  const ov = useTextOverlay();
  const [fit, setFit] = useState(0.4);
  const [scale, setScale] = useState<number | null>(null); // null = fit
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"select" | "hand">("select");
  const [safe, setSafe] = useState(false);
  const [grid, setGrid] = useState(false);
  const [rulers, setRulers] = useState(true);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const container = useRef<HTMLDivElement>(null);
  const spaceDown = useRef<{ at: number; moved: boolean } | null>(null);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const s = scale ?? fit;
  const handMode = tool === "hand" || spaceHeld;

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Space held = temporary hand; a quick tap without a drag still toggles play.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        spaceDown.current = { at: performance.now(), moved: false };
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      const d = spaceDown.current;
      spaceDown.current = null;
      setSpaceHeld(false);
      if (d && !d.moved && performance.now() - d.at < 250) pb.toggle();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [pb]);

  useTransportKeys(
    pb,
    (e) => {
      const k = e.key.toLowerCase();
      if (k === "v") return (setTool("select"), true);
      if (k === "h") return (setTool("hand"), true);
      if (k === "g") return (setGrid((g) => !g), true);
      if (k === "r" && e.altKey) return (setRulers((r) => !r), true);
      if (e.key === "'" && (e.metaKey || e.ctrlKey)) return (setSafe((v) => !v), true);
      if (e.key === "0" && (e.metaKey || e.ctrlKey)) return (setScale(null), setPan({ x: 0, y: 0 }), true);
      if (e.key === "1" && (e.metaKey || e.ctrlKey)) return (setZoomTo(1), true);
      if (e.key === "2" && (e.metaKey || e.ctrlKey)) return (setZoomTo(2), true);
      if ((e.key === "=" || e.key === "+") && (e.metaKey || e.ctrlKey)) return (zoomBy(1.25), true);
      if (e.key === "-" && (e.metaKey || e.ctrlKey)) return (zoomBy(0.8), true);
    },
    { space: false },
  );

  const setZoomTo = (z: number) => {
    setScale(z);
    setPan({ x: 0, y: 0 });
  };
  const zoomBy = (factor: number, about?: { x: number; y: number }) => {
    const next = clamp(s * factor, MIN, MAX);
    const c = about ?? { x: 0, y: 0 };
    // Keep the point under the cursor fixed: p = (c - pan)/s ; pan' = c - p*next
    setPan({ x: c.x - ((c.x - pan.x) / s) * next, y: c.y - ((c.y - pan.y) / s) * next });
    setScale(next);
  };

  // React registers wheel listeners as passive, so preventDefault lives in
  // the native listener below; this handler only does the math.
  const onWheel = (e: React.WheelEvent) => {
    const r = container.current!.getBoundingClientRect();
    const about = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
    if (e.ctrlKey || e.metaKey) zoomBy(Math.exp(-e.deltaY * 0.01), about);
    else setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
  };

  // Keep the browser from page-zooming (pinch) or scrolling the viewport.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const block = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", block, { passive: false });
    return () => el.removeEventListener("wheel", block);
  }, []);

  const zoomValue = scale === null ? "fit" : scale === 1 ? "1" : scale === 2 ? "2" : "custom";
  const originX = size.w / 2 + pan.x - (CANVAS_W * s) / 2;
  const originY = size.h / 2 + pan.y - (CANVAS_H * s) / 2;

  return (
    <EditorFrame ov={ov} time={pb.time} timeline={<TimelineStrip time={pb.time} onSeek={pb.seek} onScrubStart={pb.pause} />}>
      <div className="flex min-h-0 flex-1">
        {/* Side rail */}
        <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface-2 py-2">
          <IconButton icon={Cursor01Icon} label="Select" shortcut="V" side="right" active={tool === "select"} onClick={() => setTool("select")} />
          <IconButton icon={HandGrabIcon} label="Hand · or hold Space" shortcut="H" side="right" active={tool === "hand"} onClick={() => setTool("hand")} />
          <span className="my-1 h-px w-5 bg-border" />
          <IconButton icon={FrameIcon} label="Safe areas" shortcut="⌘'" side="right" active={safe} onClick={() => setSafe((v) => !v)} />
          <IconButton icon={Grid02Icon} label="Grid" shortcut="G" side="right" active={grid} onClick={() => setGrid((g) => !g)} />
          <IconButton icon={RulerIcon} label="Rulers" shortcut="⌥R" side="right" active={rulers} onClick={() => setRulers((r) => !r)} />
        </div>

        <PreviewCanvas
          time={pb.time}
          ov={ov}
          zoom={scale ?? "fit"}
          pan={pan}
          safe={safe}
          grid={grid}
          onFit={setFit}
          fitPadding={rulers ? 40 : 24}
          passive={handMode}
          containerRef={container}
          containerProps={{
            onWheel,
            className: cn("touch-none", handMode && (panning ? "cursor-grabbing" : "cursor-grab")),
            onPointerDown: (e) => {
              if (!handMode) return;
              e.preventDefault();
              panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
              setPanning(true);
              if (spaceDown.current) spaceDown.current.moved = true;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            },
            onPointerMove: (e) => {
              const p = panStart.current;
              if (!p) return;
              setPan({ x: p.px + (e.clientX - p.x), y: p.py + (e.clientY - p.y) });
            },
            onPointerUp: () => {
              panStart.current = null;
              setPanning(false);
            },
          }}
        >
          {rulers && <Rulers originX={originX} originY={originY} scale={s} w={size.w} h={size.h} />}

          {/* Zoom pill — top right */}
          <Elevated offset={2} className="absolute right-3 top-3 flex items-center gap-1 rounded-lg p-0.5" style={{ ...glass, top: rulers ? RULER + 8 : 12 }}>
            <span className="min-w-[44px] px-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{Math.round(s * 100)}%</span>
            <Tabs
              size="compact"
              value={zoomValue}
              onValueChange={(v) => {
                if (v === "fit") {
                  setScale(null);
                  setPan({ x: 0, y: 0 });
                } else setZoomTo(Number(v));
              }}
            >
              <TabsList aria-label="Zoom">
                <TabItem value="fit" label="Fit" />
                <TabItem value="1" label="100%" />
                <TabItem value="2" label="200%" />
              </TabsList>
            </Tabs>
          </Elevated>

          {/* Transport pill — bottom centre */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <Elevated offset={2} className="pointer-events-auto flex items-center gap-0.5 rounded-full py-0.5 pl-1 pr-3" style={glass}>
              <IconButton icon={ArrowLeft01Icon} label="Previous frame" shortcut="←" onClick={() => pb.step(-1)} />
              <IconButton icon={pb.playing ? PauseIcon : PlayIcon} label={pb.playing ? "Pause" : "Play"} shortcut="Space" onClick={pb.toggle} />
              <IconButton icon={ArrowRight01Icon} label="Next frame" shortcut="→" onClick={() => pb.step(1)} />
              <span className="ml-1.5 font-mono text-[12px] tabular-nums text-foreground">{timecode(pb.time)}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">/ {timecode(PROJECT_DURATION)}</span>
            </Elevated>
          </div>

          <AnimatePresence>
            {spaceHeld && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring.fast}
                className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[11px] text-background"
              >
                Drag to pan · release to {pb.playing ? "pause" : "play"}
              </motion.div>
            )}
          </AnimatePresence>
        </PreviewCanvas>
      </div>
    </EditorFrame>
  );
}

/** Project-pixel rulers along the top and left edges of the viewport. */
function Rulers({ originX, originY, scale, w, h }: { originX: number; originY: number; scale: number; w: number; h: number }) {
  // Pick a step whose on-screen spacing is at least 70 px.
  const steps = [10, 20, 50, 100, 200, 250, 500, 1000];
  const step = steps.find((st) => st * scale >= 70) ?? 1000;
  const ticks = (origin: number, length: number) => {
    const out: { pos: number; v: number }[] = [];
    const first = Math.floor(-origin / scale / step) * step;
    for (let v = first; origin + v * scale < length; v += step) out.push({ pos: origin + v * scale, v });
    return out;
  };
  const inCanvas = (v: number, max: number) => v >= 0 && v <= max;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 border-b border-border bg-surface-2/90 font-mono text-[9px] tabular-nums text-muted-foreground" style={{ height: RULER, left: RULER }}>
        {ticks(originX - RULER, w - RULER).map(({ pos, v }) => (
          <span key={v} className={cn("absolute bottom-0 flex h-full flex-col justify-end", inCanvas(v, CANVAS_W) ? "text-foreground/80" : "text-muted-foreground/60")} style={{ left: pos }}>
            <span className="mb-[3px] translate-x-0.5">{v}</span>
            <span className={cn("h-1.5 w-px", inCanvas(v, CANVAS_W) ? "bg-foreground/60" : "bg-border")} />
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 border-r border-border bg-surface-2/90 font-mono text-[9px] tabular-nums text-muted-foreground" style={{ width: RULER, top: RULER }}>
        {ticks(originY - RULER, h - RULER).map(({ pos, v }) => (
          <span key={v} className={cn("absolute left-0 w-full", inCanvas(v, CANVAS_H) ? "text-foreground/80" : "text-muted-foreground/60")} style={{ top: pos }}>
            <span className={cn("absolute right-0 top-0 h-px w-1.5", inCanvas(v, CANVAS_H) ? "bg-foreground/60" : "bg-border")} />
            <span className="absolute left-[3px] top-[2px] whitespace-nowrap" style={{ transform: "rotate(-90deg) translateX(-100%)", transformOrigin: "top left" }}>
              {v}
            </span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute left-0 top-0 border-b border-r border-border bg-surface-2" style={{ width: RULER, height: RULER }} />
    </>
  );
}
