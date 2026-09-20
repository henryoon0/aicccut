/**
 * Viewport hooks: zoom that keeps the time under the cursor still, the
 * scroll container's width reported to the store (so "fit" works), ruler
 * scrubbing, and the page-flip autoscroll that follows playback.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  MAX_ZOOM_PPS,
  MIN_ZOOM_PPS,
  documentDuration,
  useActions,
  useEditor,
  useEditorContext,
  useEditorStore,
  useTransportState,
} from "#/editor/core";
import { HEADER_W, TAIL_PX, clamp } from "./geometry";

export interface Viewport {
  /** The scrolling element; its left `HEADER_W` px are the sticky header column. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Wrapper around the track rows, used for pointer hit-testing. */
  rowsRef: RefObject<HTMLDivElement | null>;
  pps: number;
  /** Live zoom for pointer handlers that outlive a render. */
  ppsRef: RefObject<number>;
  /** Seconds the ruler spans (document length plus headroom). */
  duration: number;
  contentW: number;
  /** Timeline seconds under a client X position. */
  xToTime: (clientX: number) => number;
  /** Zoom by a factor, keeping the time at `viewportX` (px from the lanes' left edge) fixed. */
  zoomAround: (factor: number, viewportX: number) => void;
  zoomBy: (factor: number) => void;
  /** Fit the document into the lane width and scroll home. */
  zoomToFit: () => void;
}

/** Zoom, scroll geometry and the width report the store needs for "fit". */
export function useViewport(): Viewport {
  const actions = useActions();
  const store = useEditorStore();
  const { time } = useEditorContext();
  const pps = useEditor((s) => s.zoomPps);
  const docDuration = useEditor((s) => documentDuration(s.doc));
  const duration = Math.max(30, docDuration);
  const contentW = Math.ceil(duration * pps) + TAIL_PX;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
  const anchorRef = useRef<{ t: number; x: number } | null>(null);

  const xToTime = useCallback((clientX: number) => {
    const el = scrollRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, (clientX - r.left - HEADER_W + el.scrollLeft) / ppsRef.current);
  }, []);

  const zoomAround = useCallback(
    (factor: number, viewportX: number) => {
      const cur = ppsRef.current;
      const next = clamp(cur * factor, MIN_ZOOM_PPS, MAX_ZOOM_PPS);
      if (next === cur) return;
      const el = scrollRef.current;
      if (el) anchorRef.current = { t: (viewportX + el.scrollLeft) / cur, x: viewportX };
      actions.setZoomPps(next);
    },
    [actions],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const el = scrollRef.current;
      zoomAround(factor, el ? (el.clientWidth - HEADER_W) / 2 : 300);
    },
    [zoomAround],
  );

  // Anchored at 0 so the view starts from the head even when the document
  // is too long to fit at the minimum zoom.
  const zoomToFit = useCallback(() => {
    const before = ppsRef.current;
    anchorRef.current = { t: 0, x: 0 };
    actions.zoomToFit();
    if (store.getState().zoomPps === before) {
      // Already fitted: no zoom change, so no layout pass; scroll home now.
      anchorRef.current = null;
      const el = scrollRef.current;
      if (el) el.scrollLeft = 0;
    }
  }, [actions, store]);

  // Zooms that arrive without an anchor (keyboard = / -, presets, Shift+Z)
  // keep the playhead still when it is in view, else the viewport centre.
  // The anchor is taken in the store listener, before React resizes the
  // lanes, so a shrinking content width cannot clamp the scroll first.
  useEffect(() => {
    let last = store.getState().zoomPps;
    return store.subscribe((s) => {
      if (s.zoomPps === last) return;
      const el = scrollRef.current;
      if (el && !anchorRef.current) {
        const viewW = el.clientWidth - HEADER_W;
        const x = time.get() * last - el.scrollLeft;
        const vx = x >= 0 && x <= viewW ? x : viewW / 2;
        anchorRef.current = { t: (vx + el.scrollLeft) / last, x: vx };
      }
      last = s.zoomPps;
    });
  }, [store, time]);

  // Re-anchor the scroll after a zoom so the anchored time stays put. When
  // the whole document now fits, scroll home so "fit" shows it from 0.
  useLayoutEffect(() => {
    const a = anchorRef.current;
    anchorRef.current = null;
    const el = scrollRef.current;
    if (!a || !el) return;
    el.scrollLeft = docDuration * pps <= el.clientWidth - HEADER_W ? 0 : Math.max(0, a.t * pps - a.x);
  }, [pps, docDuration]);

  // Cmd/Ctrl + wheel zooms at the cursor; Shift + wheel pans.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        zoomAround(Math.exp(-e.deltaY * 0.01), e.clientX - r.left - HEADER_W);
      } else if (e.shiftKey && e.deltaX === 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAround]);

  // Report the lane viewport width (without the header column) so
  // `zoomToFit` has something to fit into. This is the only publisher.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = Math.max(0, el.clientWidth - HEADER_W);
      if (w > 0 && Math.abs(w - store.getState().uiPanels.timelineWidth) > 0.5) actions.setUi({ timelineWidth: w });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [actions, store]);

  return useMemo(
    () => ({ scrollRef, rowsRef, pps, ppsRef, duration, contentW, xToTime, zoomAround, zoomBy, zoomToFit }),
    [pps, duration, contentW, xToTime, zoomAround, zoomBy, zoomToFit],
  );
}

/** Ruler click / drag scrubbing. Pauses playback like a real scrub wheel. */
export function useScrub(view: Viewport) {
  const { time, transport } = useEditorContext();
  const { xToTime } = view;
  return useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      transport.pause();
      time.set(xToTime(e.clientX));
      const move = (ev: PointerEvent) => time.set(xToTime(ev.clientX));
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [time, transport, xToTime],
  );
}

/** While playing, flip the view forward a page whenever the playhead leaves it. */
export function usePlaybackAutoscroll(view: Viewport) {
  const { time } = useEditorContext();
  const { playing } = useTransportState();
  const { scrollRef, ppsRef } = view;
  useEffect(() => {
    if (!playing) return;
    return time.subscribe((t) => {
      const el = scrollRef.current;
      if (!el) return;
      const x = t * ppsRef.current - el.scrollLeft;
      const view_ = el.clientWidth - HEADER_W;
      // Forwards the playhead lands near the left edge of the new page,
      // backwards (J shuttle) near the right edge, so each flip is a page.
      if (x > view_ - 24) el.scrollLeft = Math.max(0, t * ppsRef.current - 24);
      else if (x < 0) el.scrollLeft = Math.max(0, t * ppsRef.current - (view_ - 24));
    });
  }, [playing, time, scrollRef, ppsRef]);
}
