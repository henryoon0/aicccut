/**
 * Pointer gestures that edit the document: moving clips (with snapping and
 * vertical track changes), trimming an edge, and dropping an asset from the
 * media panel. Every gesture previews through core and commits on release.
 */
import { useCallback, useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  DEFAULT_STILL_DURATION,
  assetById,
  clipById,
  clipTrackKind,
  snapCandidates,
  snapTime,
  trackById,
  trackKindFor,
  useActions,
  useEditorContext,
  useEditorStore,
} from "#/editor/core";
import type { Clip, Edge } from "#/editor/core";
import { ASSET_DRAG_EVENT } from "#/editor/media";
import type { AssetDragEvent } from "#/editor/media";
import { DRAG_SLOP, HEADER_W, SNAP_PX, trackAtPoint } from "./geometry";
import type { Viewport } from "./engine";

export interface TrimState {
  clipId: string;
  edge: Edge;
  label: string;
  /** Seconds the edge travelled: negative means earlier (a start edge grows the clip, an end edge shrinks it). */
  delta: number;
  duration: number;
  clientX: number;
  clientY: number;
}

export interface DropGhost {
  trackId: string;
  time: number;
  duration: number;
  tint: string;
  label: string;
}

export interface TimelineDrags {
  dragId: string | null;
  snapLine: number | null;
  trim: TrimState | null;
  ghost: DropGhost | null;
  onClipPointerDown: (e: ReactPointerEvent, clip: Clip) => void;
  startTrim: (e: ReactPointerEvent, clip: Clip, edge: Edge) => void;
}

function listen(move: (e: PointerEvent) => void, end: () => void) {
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    end();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

export function useTimelineDrags(view: Viewport): TimelineDrags {
  const actions = useActions();
  const store = useEditorStore();
  const { time } = useEditorContext();
  const { ppsRef, rowsRef, scrollRef, xToTime } = view;
  const [dragId, setDragId] = useState<string | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [trim, setTrim] = useState<TrimState | null>(null);
  const [ghost, setGhost] = useState<DropGhost | null>(null);

  // ── move ────────────────────────────────────────────────
  const onClipPointerDown = useCallback(
    (e: ReactPointerEvent, clip: Clip) => {
      const state = store.getState();
      const selected = state.selection.clipIds;
      // Right-click selects only once the menu is open: selecting here would
      // unfold the keyframe lanes and reflow the rows before the browser's
      // `contextmenu` event fires, so the menu would target the wrong clip.
      if (e.button !== 0) return;
      e.stopPropagation();
      // A press inside a multi-selection keeps it, so the whole group can be
      // dragged; a click that never moves collapses to this clip.
      let collapseOnClick = false;
      if (e.shiftKey) actions.select(clip.id, true);
      else if (!selected.includes(clip.id)) actions.select(clip.id, false);
      else if (selected.length > 1) collapseOnClick = true;

      if (trackById(state.doc, clip.trackId)?.locked) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const group = store
        .getState()
        .selection.clipIds.map((id) => clipById(store.getState().doc, id))
        .filter((c): c is Clip => !!c && !trackById(store.getState().doc, c.trackId)?.locked);
      const origins = new Map(group.map((c) => [c.id, c.start]));
      if (!origins.has(clip.id)) origins.set(clip.id, clip.start);
      let moved = false;

      const move = (ev: PointerEvent) => {
        // Distance, not just horizontal: a straight vertical drag changes track.
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_SLOP) return;
        if (!moved) {
          moved = true;
          setDragId(clip.id);
        }
        const pps = ppsRef.current;
        const st = store.getState();
        let start = Math.max(0, clip.start + (ev.clientX - startX) / pps);
        let line: number | null = null;
        if (st.snapping) {
          const cands = snapCandidates(st.doc, [...origins.keys()], time.get());
          const thr = SNAP_PX / pps;
          const head = snapTime(start, cands, thr);
          const tail = snapTime(start + clip.duration, cands, thr);
          const dh = head.snapped ? Math.abs(head.time - start) : Infinity;
          const dt = tail.snapped ? Math.abs(tail.time - start - clip.duration) : Infinity;
          if (dh <= dt && head.snapped) {
            start = head.time;
            line = head.time;
          } else if (tail.snapped) {
            start = Math.max(0, tail.time - clip.duration);
            line = tail.time;
          }
        }
        setSnapLine(line);

        const delta = start - clip.start;
        const hit = trackAtPoint(rowsRef.current, ev.clientY);
        const kind = clipTrackKind(st.doc, clip);
        const target = hit && trackById(st.doc, hit)?.kind === kind && !trackById(st.doc, hit)?.locked ? hit : undefined;
        // Move the far end of the group first so clips never block each other.
        const order = [...origins.entries()].sort((a, b) => (delta >= 0 ? b[1] - a[1] : a[1] - b[1]));
        for (const [id, origin] of order) {
          const to = Math.max(0, origin + delta);
          actions.moveClip(id, to, id === clip.id ? target : undefined, { preview: true });
        }
      };

      listen(move, () => {
        if (moved) actions.commit();
        else if (collapseOnClick) actions.select(clip.id, false);
        setDragId(null);
        setSnapLine(null);
      });
    },
    [actions, ppsRef, rowsRef, store, time],
  );

  // ── trim ────────────────────────────────────────────────
  const startTrim = useCallback(
    (e: ReactPointerEvent, clip: Clip, edge: Edge) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      actions.select(clip.id, false);
      const orig = clip;
      const startX = e.clientX;
      const anchor = edge === "start" ? orig.start : orig.start + orig.duration;
      setTrim({ clipId: orig.id, edge, label: orig.label, delta: 0, duration: orig.duration, clientX: e.clientX, clientY: e.clientY });

      const move = (ev: PointerEvent) => {
        const pps = ppsRef.current;
        const st = store.getState();
        const cur = clipById(st.doc, orig.id);
        if (!cur) return;
        let ds = (ev.clientX - startX) / pps;
        let line: number | null = null;
        if (st.snapping) {
          const hit = snapTime(anchor + ds, snapCandidates(st.doc, [orig.id], time.get()), SNAP_PX / pps);
          if (hit.snapped) {
            ds = hit.time - anchor;
            line = hit.time;
          }
        }
        setSnapLine(line);
        // `applied` is what the document already absorbed, so a clamped edge
        // (source length, neighbour) stops without the drag running away.
        const applied = edge === "start" ? cur.inPoint - orig.inPoint : cur.duration - orig.duration;
        actions.trimClip(orig.id, edge, ds - applied, undefined, { preview: true });
        const after = clipById(store.getState().doc, orig.id) ?? cur;
        setTrim({
          clipId: orig.id,
          edge,
          label: orig.label,
          delta: edge === "start" ? orig.duration - after.duration : after.duration - orig.duration,
          duration: after.duration,
          clientX: ev.clientX,
          clientY: ev.clientY,
        });
      };

      listen(move, () => {
        actions.commit();
        setTrim(null);
        setSnapLine(null);
      });
    },
    [actions, ppsRef, store, time],
  );

  // ── asset drop from the media panel ─────────────────────
  useEffect(() => {
    const onDrag = (raw: Event) => {
      const d = (raw as AssetDragEvent).detail;
      const el = scrollRef.current;
      if (!d || !el) return;
      if (d.phase === "start") {
        setGhost(null);
        return;
      }
      const st = store.getState();
      const asset = assetById(st.doc, d.assetId);
      const r = el.getBoundingClientRect();
      const over =
        !!asset && d.clientX >= r.left + HEADER_W && d.clientX <= r.right && d.clientY >= r.top && d.clientY <= r.bottom;
      if (!over || !asset) {
        setGhost(null);
        return;
      }
      const kind = trackKindFor(asset.kind);
      const hit = trackAtPoint(rowsRef.current, d.clientY);
      const hitTrack = hit ? trackById(st.doc, hit) : undefined;
      // A row of the right kind takes the drop; a locked one refuses it
      // outright (no ghost) rather than silently landing elsewhere. Rows of
      // another kind fall back to the first unlocked track of the kind.
      const trackId =
        hitTrack?.kind === kind ? (hitTrack.locked ? undefined : hitTrack.id) : st.doc.tracks.find((t) => t.kind === kind && !t.locked)?.id;
      if (!trackId) {
        setGhost(null);
        return;
      }
      let t = xToTime(d.clientX);
      if (st.snapping) t = snapTime(t, snapCandidates(st.doc, [], time.get()), SNAP_PX / ppsRef.current).time;
      t = Math.max(0, t);
      if (d.phase === "end") {
        setGhost(null);
        actions.addClipFromAsset(d.assetId, trackId, t);
        return;
      }
      setGhost({ trackId, time: t, duration: asset.duration > 0 ? asset.duration : DEFAULT_STILL_DURATION, tint: asset.tint, label: asset.name });
    };
    window.addEventListener(ASSET_DRAG_EVENT, onDrag);
    return () => window.removeEventListener(ASSET_DRAG_EVENT, onDrag);
  }, [actions, ppsRef, rowsRef, scrollRef, store, time, xToTime]);

  return { dragId, snapLine, trim, ghost, onClipPointerDown, startTrim };
}
