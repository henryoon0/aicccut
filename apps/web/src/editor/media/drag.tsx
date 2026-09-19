/**
 * Cross-area drag protocol: media → timeline.
 *
 * The media panel owns the pointer and the ghost; the timeline owns the drop.
 * After the pointer travels 4px from its press point the panel dispatches a
 * `CustomEvent` on `window` for every move and once more on release:
 *
 * ```ts
 * window.addEventListener("opencut:asset-drag", (e) => {
 *   const { assetId, phase, clientX, clientY } = (e as AssetDragEvent).detail;
 *   // phase: "start" → first move past the threshold
 *   //        "move"  → every subsequent move
 *   //        "end"   → pointer released (or cancelled); drop here
 * });
 * ```
 *
 * `end` always follows a `start`, including on pointercancel, so a receiver
 * never leaks a highlighted drop target. Coordinates are viewport pixels.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { spring } from "#/lib/springs";
import { shortDuration, type Asset } from "#/editor/core";
import { Thumb } from "./thumb";

export const ASSET_DRAG_EVENT = "opencut:asset-drag";

export type AssetDragPhase = "start" | "move" | "end";

export interface AssetDragDetail {
  assetId: string;
  phase: AssetDragPhase;
  clientX: number;
  clientY: number;
}

export type AssetDragEvent = CustomEvent<AssetDragDetail>;

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

function dispatch(detail: AssetDragDetail) {
  window.dispatchEvent(new CustomEvent<AssetDragDetail>(ASSET_DRAG_EVENT, { detail }));
}

export interface DragState {
  asset: Asset;
  x: number;
  y: number;
}

/**
 * Pointer-drag source for asset tiles. `begin(asset, event)` on pointerdown;
 * nothing happens until the pointer passes the threshold, so a plain click
 * still selects.
 */
export function useAssetDrag() {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  // A tile unmounting mid-drag (filter change, remove) must not strand the
  // window listeners or the grabbing cursor.
  useEffect(() => () => cleanup.current?.(), []);

  const begin = useCallback((asset: Asset, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let started = false;

    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      cleanup.current = null;
    };

    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
        started = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        dispatch({ assetId: asset.id, phase: "start", clientX: ev.clientX, clientY: ev.clientY });
      } else {
        dispatch({ assetId: asset.id, phase: "move", clientX: ev.clientX, clientY: ev.clientY });
      }
      setDragging({ asset, x: ev.clientX, y: ev.clientY });
    };

    const onUp = (ev: PointerEvent) => {
      stop();
      if (!started) return;
      setDragging(null);
      dispatch({ assetId: asset.id, phase: "end", clientX: ev.clientX, clientY: ev.clientY });
    };

    cleanup.current = () => {
      if (started) dispatch({ assetId: asset.id, phase: "end", clientX: sx, clientY: sy });
      stop();
      setDragging(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  return { begin, dragging };
}

/** The ghost that follows the pointer; fixed so it can leave the panel. */
export function DragGhost({ state }: { state: DragState | null }) {
  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={spring.fast}
          data-testid="asset-drag-ghost"
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-md bg-surface-6 py-1 pl-1 pr-2.5 text-xs shadow-surface-5"
          style={{ left: state.x + 10, top: state.y + 10 }}
        >
          <Thumb asset={state.asset} className="h-6 w-10 rounded-[4px]" bars={12} />
          <span className="max-w-[160px] truncate">{state.asset.name}</span>
          {state.asset.kind !== "image" && (
            <span className="tabular-nums text-muted-foreground">{shortDuration(state.asset.duration)}</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
