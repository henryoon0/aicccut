"use client";

/**
 * Focus — the preview is the window. Media and inspector are floating,
 * draggable translucent panels toggled from a bottom toolbar; the timeline is a
 * slim strip along the bottom that expands on hover or click.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, Film, GripHorizontal, Pause, Play, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { Elevated } from "#/lib/elevated.tsx";
import { cn } from "#/lib/utils.ts";
import { spring } from "#/lib/springs.ts";
import { PROJECT_DURATION, timecode } from "#/prototypes/mock";
import { InspectorFields, MediaGrid, PreviewCanvas } from "./panels";
import { PROJECT, TimelineStrip, TopBar, useTransport, useTransportKeys } from "./shared";

/** A floating panel you can drag by its header. */
function Floating({
  title,
  icon: Icon,
  initial,
  onClose,
  width,
  children,
}: {
  title: string;
  icon: LucideIcon;
  /** Anchor from the left or the right edge of the stage. */
  initial: { x?: number; right?: number; y: number };
  onClose: () => void;
  width: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: initial.x ?? 0, y: initial.y });
  // Right-anchored panels need the stage width, so resolve once on mount.
  useLayoutEffect(() => {
    if (initial.right === undefined) return;
    const parent = ref.current?.offsetParent as HTMLElement | null;
    if (parent) setPos((p) => ({ ...p, x: Math.max(8, parent.clientWidth - width - (initial.right ?? 0)) }));
  }, [initial.right, width]);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos({ x: Math.max(8, e.clientX - drag.current.dx), y: Math.max(8, e.clientY - drag.current.dy) });
  };
  const onUp = () => (drag.current = null);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={spring.moderate}
      className="absolute z-20 origin-bottom"
      style={{ left: pos.x, top: pos.y, width }}
    >
      <Elevated
        offset={2}
        className="flex max-h-[60vh] flex-col overflow-hidden rounded-xl bg-surface-3/85 shadow-surface-4 backdrop-blur-xl"
      >
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="flex h-9 shrink-0 cursor-grab items-center gap-2 border-b border-border/60 px-3 text-[12px] font-medium select-none active:cursor-grabbing"
        >
          <Icon size={13} className="text-muted-foreground" />
          {title}
          <GripHorizontal size={14} className="ml-auto text-muted-foreground/60" />
          <Button variant="ghost" size="icon-compact" aria-label={`Close ${title}`} onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </Elevated>
    </motion.div>
  );
}

export function Focus() {
  const t = useTransport();
  useTransportKeys(t);
  const [media, setMedia] = useState(false);
  const [inspector, setInspector] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState(false);
  const open = expanded || hover;

  // M / I toggle floating panels, T expands the timeline.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "m") setMedia((v) => !v);
      if (e.key === "i") setInspector((v) => !v);
      if (e.key === "t") setExpanded((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-surface-1 text-foreground">
      <TopBar className="border-b-0 bg-transparent" />

      {/* Stage */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-x-0 top-0 bottom-14 flex">
          <PreviewCanvas t={t} className="p-6 [--pv-pad:3rem]" frameClassName="shadow-surface-6" />
        </div>

        <AnimatePresence>
          {media && (
            <Floating
              key="media"
              title="Media"
              icon={Film}
              width={300}
              initial={{ x: 16, y: 12 }}
              onClose={() => setMedia(false)}
            >
              <MediaGrid columns={2} />
            </Floating>
          )}
          {inspector && (
            <Floating
              key="inspector"
              title="Inspector"
              icon={SlidersHorizontal}
              width={280}
              initial={{ right: 16, y: 12 }}
              onClose={() => setInspector(false)}
            >
              <InspectorFields />
            </Floating>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom dock: toolbar + slim timeline that grows */}
      <motion.div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        initial={false}
        animate={{ height: open ? 232 : 84 }}
        transition={spring.moderate}
        className="relative z-10 flex shrink-0 flex-col border-t border-border bg-surface-2/90 backdrop-blur-md"
      >
        <div className="flex h-11 shrink-0 items-center gap-2 px-3">
          <Tooltip content={t.playing ? "Pause (Space)" : "Play (Space)"} side="top">
            <Button variant="secondary" size="icon-compact" aria-label="Play" onClick={t.toggle}>
              {t.playing ? <Pause /> : <Play />}
            </Button>
          </Tooltip>
          <span className="text-[12px] tabular-nums">{timecode(t.time, PROJECT.fps)}</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">/ {timecode(PROJECT_DURATION, PROJECT.fps)}</span>
          <div className="mx-auto flex items-center gap-1">
            <Tooltip content="Media (M)" side="top">
              <Button variant="ghost" size="compact" leadingIcon={Film} active={media} onClick={() => setMedia((v) => !v)}>
                Media
              </Button>
            </Tooltip>
            <Tooltip content="Inspector (I)" side="top">
              <Button
                variant="ghost"
                size="compact"
                leadingIcon={SlidersHorizontal}
                active={inspector}
                onClick={() => setInspector((v) => !v)}
              >
                Inspector
              </Button>
            </Tooltip>
          </div>
          <Tooltip content={expanded ? "Collapse timeline (T)" : "Expand timeline (T)"} side="top">
            <Button
              variant="ghost"
              size="icon-compact"
              aria-label="Toggle timeline"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <ChevronUp className={cn("transition-transform duration-150", expanded && "rotate-180")} />
            </Button>
          </Tooltip>
        </div>
        {/* Slim strip: bars only, no headers. Expands into full track list. */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <TimelineStrip
            t={t}
            trackHeight={open ? 26 : 5}
            headerWidth={open ? 96 : 0}
            showRuler={open}
            className={cn("h-full", !open && "[&_button]:inset-y-px [&_button]:rounded-[1px] [&_button_span]:hidden")}
          />
        </div>
      </motion.div>
    </div>
  );
}
