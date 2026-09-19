/**
 * Handles — the classic NLE feel. Select a clip and two grab handles appear
 * on its edges; drag them with a col-resize cursor. While trimming, a delta
 * chip follows the pointer and a dashed ghost shows the original extent.
 */
import { useState, type PointerEvent as RPE } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { fmtDelta, useEditor, useEditorKeys, type EClip, type Edge } from "./model";
import { ClipBox, EditorFrame, GhostExtent, TimelineBase, TRACK_H, trackIndex, useTrimDrag, type ClipCtx, type Geo } from "./shared";

export function Handles() {
  const ed = useEditor();
  useEditorKeys(ed);
  const [geo, setGeo] = useState<Geo | null>(null);
  const { trim, start } = useTrimDrag(ed, geo);

  const renderClip = (ctx: ClipCtx) => {
    const { clip, selected } = ctx;
    const trimming = trim?.clipId === clip.id;
    return (
      <ClipBox
        ctx={ctx}
        className={cn("cursor-default", !selected && "hover:brightness-110")}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          ed.select(clip.id, e.shiftKey);
        }}
      >
        {selected && (
          <>
            <Handle edge="start" clip={clip} active={trimming && trim.edge === "start"} onStart={start} />
            <Handle edge="end" clip={clip} active={trimming && trim.edge === "end"} onStart={start} />
          </>
        )}
      </ClipBox>
    );
  };

  return (
    <EditorFrame
      ed={ed}
      timeline={
        <TimelineBase
          ed={ed}
          onGeo={setGeo}
          renderClip={renderClip}
          overlay={(g) => (
            <>
              <GhostExtent trim={trim} geo={g} />
              <DeltaChip geo={g} trim={trim} />
            </>
          )}
        />
      }
    />
  );
}

function Handle({ edge, clip, active, onStart }: { edge: Edge; clip: EClip; active: boolean; onStart: (e: RPE, clip: EClip, edge: Edge) => void }) {
  return (
    <div
      role="separator"
      aria-label={edge === "start" ? "Trim start" : "Trim end"}
      className={cn(
        "group/handle absolute inset-y-0 z-20 flex w-3 cursor-col-resize items-center justify-center",
        edge === "start" ? "left-0" : "right-0",
      )}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onStart(e, clip, edge);
      }}
    >
      <div
        className={cn(
          "h-[60%] w-[5px] rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,.35)] transition-[transform,background-color] duration-100",
          "group-hover/handle:scale-y-110 group-hover/handle:bg-[#ffd166]",
          active && "scale-y-110 bg-[#ffd166]",
        )}
      >
        <div className="mx-auto mt-[40%] h-[20%] w-px bg-black/40" />
      </div>
    </div>
  );
}

function DeltaChip({ geo, trim }: { geo: Geo; trim: ReturnType<typeof useTrimDrag>["trim"] }) {
  return (
    <AnimatePresence>
      {trim && (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full"
          style={{
            left: Math.min(geo.width - 80, Math.max(80, geo.x(trim.edge === "start" ? trim.current.start : trim.current.start + trim.current.duration))),
            top: trackIndex(trim.current.trackId) * TRACK_H - 4,
          }}
        >
          <motion.div
            key="chip"
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.98 }}
            transition={spring.fast}
            className="whitespace-nowrap rounded-md bg-surface-6 px-2 py-1 text-[11px] font-medium tabular-nums text-foreground shadow-surface-6"
          >
            <span className={cn(trim.delta < 0 ? "text-[#ff7a7a]" : trim.delta > 0 ? "text-[#7ad9a1]" : "text-muted-foreground")}>{fmtDelta(trim.delta)}</span>
            <span className="text-muted-foreground"> · </span>
            {trim.current.duration.toFixed(1)} s
            <span className="text-muted-foreground"> · in {trim.current.inPoint.toFixed(1)} s</span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
