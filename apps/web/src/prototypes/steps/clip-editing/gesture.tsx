/**
 * Gesture — no toolbar. Hovering a clip surfaces a tiny action bar above it
 * (Split here · Duplicate · Mute · Delete). Edges glow as the pointer nears
 * them and become the trim grip; while trimming, a magnified strip of frames
 * hangs over the dragged edge so you see *what* you are cutting on.
 */
import { useState, type PointerEvent as RPE } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Scissors, Trash, Volume2, VolumeX } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Tooltip } from "#/components/ui/tooltip";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { timecode } from "#/prototypes/mock";
import { endOf, fmtDelta, useEditor, useEditorKeys, type EClip, type Edge, type EditorApi } from "./model";
import { ClipBox, EditorFrame, RippleSwitch, TimelineBase, TRACK_H, trackIndex, UndoRedo, useTrimDrag, type ClipCtx, type Geo, type TrimState } from "./shared";

const EDGE_PX = 10;

interface Hover {
  id: string;
  /** Timeline seconds under the pointer. */
  t: number;
  edge: Edge | null;
}

export function Gesture() {
  const ed = useEditor();
  useEditorKeys(ed);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const { trim, start } = useTrimDrag(ed, geo);

  const onClipMove = (e: RPE, ctx: ClipCtx) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const edge: Edge | null = dx <= EDGE_PX ? "start" : r.width - dx <= EDGE_PX ? "end" : null;
    setHover({ id: ctx.clip.id, t: ctx.geo.timeAt(e.clientX), edge });
  };

  const renderClip = (ctx: ClipCtx) => {
    const { clip } = ctx;
    const h = hover?.id === clip.id ? hover : null;
    const trimming = trim?.clipId === clip.id;
    return (
      <ClipBox
        ctx={ctx}
        className={cn("group", h?.edge || trimming ? "cursor-col-resize" : "cursor-default")}
        onPointerMove={(e) => !trim && onClipMove(e, ctx)}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          if (h?.edge) {
            start(e, clip, h.edge);
            return;
          }
          ed.select(clip.id, e.shiftKey);
        }}
      >
        <EdgeGlow side="start" on={h?.edge === "start" || (trimming && trim.edge === "start")} tint={clip.tint} />
        <EdgeGlow side="end" on={h?.edge === "end" || (trimming && trim.edge === "end")} tint={clip.tint} />
        {h && !h.edge && !trim && (
          <div className="pointer-events-none absolute inset-y-0 w-px border-l border-dashed border-white/70" style={{ left: ctx.geo.x(h.t - clip.start) }} />
        )}
      </ClipBox>
    );
  };

  const hovered = hover ? ed.clips.find((c) => c.id === hover.id) : undefined;

  return (
    <EditorFrame
      ed={ed}
      tools={
        <>
          <RippleSwitch ed={ed} />
          <UndoRedo ed={ed} />
        </>
      }
      timeline={
        <TimelineBase
          ed={ed}
          onGeo={setGeo}
          renderClip={renderClip}
          onLaneLeave={() => !trim && setHover(null)}
          onLanePointerMove={(e) => {
            const el = e.target as HTMLElement;
            if (!trim && !el.closest("[data-clip]") && !el.closest("[data-actionbar]")) setHover(null);
          }}
          overlay={(g) => (
            <>
              <AnimatePresence>
                {hovered && hover && !trim && (
                  <ActionBar key={hovered.id} clip={hovered} at={hover.t} geo={g} ed={ed} />
                )}
              </AnimatePresence>
              <AnimatePresence>{trim && <FrameStrip key="strip" trim={trim} geo={g} />}</AnimatePresence>
            </>
          )}
        />
      }
    />
  );
}

function EdgeGlow({ side, on, tint }: { side: Edge; on: boolean; tint: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-y-0 w-5 transition-opacity duration-100", side === "start" ? "left-0" : "right-0", on ? "opacity-100" : "opacity-0")}
      style={{ background: `linear-gradient(${side === "start" ? "90deg" : "270deg"}, #fff 0, #ffffffaa 2px, ${tint}00 100%)` }}
    />
  );
}

function ActionBar({ clip, at, geo, ed }: { clip: EClip; at: number; geo: Geo; ed: EditorApi }) {
  const cx = geo.x(clip.start + clip.duration / 2);
  const left = Math.min(geo.width - 90, Math.max(90, cx));
  const top = trackIndex(clip.trackId) * TRACK_H - 22;
  const muted = !!clip.muted;
  return (
    <div data-actionbar className="absolute z-40 -translate-x-1/2" style={{ left, top }}>
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.96 }}
        transition={spring.fast}
        style={{ transformOrigin: "50% 100%" }}
        className="flex items-center gap-0.5 rounded-lg bg-surface-6 p-0.5 shadow-surface-6 motion-reduce:transition-none"
      >
        <Tooltip content={`Split here · ${at.toFixed(2)} s`} side="top">
          <Button variant="ghost" size="icon-compact" aria-label="Split here" onPointerDown={(e) => e.stopPropagation()} onClick={() => ed.split([clip.id], at)}>
            <Scissors size={13} />
          </Button>
        </Tooltip>
        <Tooltip content="Duplicate · ⌘D" side="top">
          <Button variant="ghost" size="icon-compact" aria-label="Duplicate" onPointerDown={(e) => e.stopPropagation()} onClick={() => ed.duplicate(clip.id)}>
            <Copy size={13} />
          </Button>
        </Tooltip>
        <Tooltip content={muted ? "Unmute · M" : "Mute · M"} side="top">
          <Button variant="ghost" size="icon-compact" aria-label={muted ? "Unmute" : "Mute"} active={muted} onPointerDown={(e) => e.stopPropagation()} onClick={() => ed.toggleMute([clip.id])}>
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </Button>
        </Tooltip>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <Tooltip content={ed.ripple ? "Ripple delete · ⌫" : "Delete · ⌫"} side="top">
          <Button variant="ghost" size="icon-compact" aria-label="Delete" className="hover:text-destructive" onPointerDown={(e) => e.stopPropagation()} onClick={() => ed.remove([clip.id])}>
            <Trash size={13} />
          </Button>
        </Tooltip>
      </motion.div>
    </div>
  );
}

/** Seven pseudo-frames around the source time of the dragged edge. */
function FrameStrip({ trim, geo }: { trim: TrimState; geo: Geo }) {
  const c = trim.current;
  const edgeT = trim.edge === "start" ? c.start : endOf(c);
  const srcT = trim.edge === "start" ? c.inPoint : c.inPoint + c.duration;
  const left = Math.min(geo.width - 150, Math.max(150, geo.x(edgeT)));
  const top = trackIndex(c.trackId) * TRACK_H - 6;
  const frames = [-3, -2, -1, 0, 1, 2, 3];
  return (
    <div className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full" style={{ left, top }}>
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4 }}
        transition={spring.fast}
        style={{ transformOrigin: "50% 100%" }}
        className="rounded-lg bg-surface-6 p-1.5 shadow-surface-6"
      >
        <div className="flex items-end gap-0.5">
          {frames.map((f) => {
            const t = srcT + f / 6;
            const center = f === 0;
            const hue = Math.round(((Math.sin(t * 1.7) + 1) / 2) * 40 - 20);
            return (
              <div key={f} className={cn("relative overflow-hidden rounded-sm transition-[height,width] duration-100", center ? "h-11 w-[68px] ring-2 ring-white" : "h-9 w-14 opacity-80")}>
                <div className="absolute inset-0" style={{ background: `linear-gradient(${135 + hue}deg, ${c.tint}, ${c.tint}55 70%, #000 100%)`, filter: `brightness(${1 + (t % 1) * 0.35})` }} />
                <span className="absolute bottom-0.5 left-1 text-[9px] tabular-nums text-white/85">{timecode(Math.max(0, t)).slice(3)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex items-center justify-between px-0.5 text-[10px] tabular-nums">
          <span className={cn("font-medium", trim.delta < 0 ? "text-[#ff7a7a]" : trim.delta > 0 ? "text-[#7ad9a1]" : "text-muted-foreground")}>{fmtDelta(trim.delta)}</span>
          <span className="text-muted-foreground">
            {trim.edge === "start" ? "in" : "out"} {srcT.toFixed(2)} s · {c.duration.toFixed(1)} s
          </span>
        </div>
      </motion.div>
    </div>
  );
}
