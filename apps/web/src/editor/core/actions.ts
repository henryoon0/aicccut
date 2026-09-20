/**
 * Every document operation as a store-bound action, so callers write
 * `actions.splitClips(ids, t)`. Document actions accept a trailing
 * `{ preview: true }` to skip history (see store.ts). Selection, ripple,
 * snapping, zoom and UI actions never push history.
 */
import * as D from "./document";
import type { EditorStore, MutateOpts, UiState } from "./store";
import { MAX_ZOOM_PPS, MIN_ZOOM_PPS } from "./store";
import type { Asset, Channel, ClipProps, ClipText, Document, Easing, Edge, EffectType, TrackFlag, TrackKind } from "./types";

export type Actions = ReturnType<typeof createActions>;

/** Build the actions object for a store (called once by createEditorStore). */
export function createActions(store: EditorStore) {
  const mut = (fn: (d: Document) => Document, o?: MutateOpts) => store.mutateDoc(fn, o);
  const sel = () => store.getState().selection.clipIds;
  const setSel = (clipIds: string[]) => store.setState({ selection: { clipIds } });

  return {
    // ── history ──
    /** Push the pre-preview snapshot after a drag session. */
    commit: () => store.commit(),
    undo: () => store.undo(),
    redo: () => store.redo(),
    /** Replace the document and clear history (project load). */
    replaceDoc: (doc: Document) => store.replaceDoc(doc),

    // ── assets ──
    addAsset: (input: Parameters<typeof D.addAsset>[1], o?: MutateOpts) => {
      let asset: Asset | undefined;
      mut((d) => {
        const r = D.addAsset(d, input);
        asset = r.asset;
        return r.doc;
      }, o);
      return asset as Asset;
    },
    removeAsset: (assetId: string, o?: MutateOpts) => mut((d) => D.removeAsset(d, assetId), o),

    // ── clips ──
    /** Insert a clip for an asset; the new clip becomes the selection. */
    addClipFromAsset: (assetId: string, trackId: string | "auto", start: number, o?: MutateOpts) => {
      let clipId: string | undefined;
      mut((d) => {
        const r = D.addClipFromAsset(d, assetId, trackId, start);
        clipId = r.clip?.id;
        return r.doc;
      }, o);
      if (clipId && !o?.preview) setSel([clipId]);
      return clipId;
    },
    /** Insert a text clip at `start`; it becomes the selection. */
    addTextClip: (start: number, content?: string, duration?: number, o?: MutateOpts) => {
      let clipId: string | undefined;
      mut((d) => {
        const r = D.addTextClip(d, start, content, duration);
        clipId = r.clip?.id;
        return r.doc;
      }, o);
      if (clipId && !o?.preview) setSel([clipId]);
      return clipId;
    },
    moveClip: (id: string, start: number, trackId?: string, o?: MutateOpts) => mut((d) => D.moveClip(d, id, start, trackId), o),
    /** Trim an edge by delta seconds; `ripple` defaults to the store's ripple flag. */
    trimClip: (id: string, edge: Edge, delta: number, ripple?: boolean, o?: MutateOpts) =>
      mut((d) => D.trimClip(d, id, edge, delta, ripple ?? store.getState().ripple), o),
    /** Trim the given edge of the clip to the playhead time `t`. */
    trimToTime: (id: string, edge: Edge, t: number, ripple?: boolean, o?: MutateOpts) =>
      mut((d) => {
        const c = D.clipById(d, id);
        if (!c || t <= c.start || t >= D.endOf(c)) return d;
        return D.trimClip(d, id, edge, edge === "start" ? t - c.start : t - D.endOf(c), ripple ?? store.getState().ripple);
      }, o),
    slipClip: (id: string, delta: number, o?: MutateOpts) => mut((d) => D.slipClip(d, id, delta), o),
    rollCut: (leftId: string, rightId: string, delta: number, o?: MutateOpts) => mut((d) => D.rollCut(d, leftId, rightId, delta), o),
    /** Split clips at t (defaults: selection, else clips under t). Right halves become the selection. */
    splitClips: (ids: string[] | undefined, t: number, o?: MutateOpts) => {
      let rightIds: string[] = [];
      mut((d) => {
        const targets = ids ?? (sel().length ? sel() : D.clipsAt(d, t).map((c) => c.id));
        const r = D.splitClips(d, targets, t);
        rightIds = r.rightIds;
        return r.doc;
      }, o);
      if (rightIds.length && !o?.preview) setSel(rightIds);
      return rightIds;
    },
    /** Delete clips (defaults to the selection); ripple defaults to the store flag. */
    deleteClips: (ids?: string[], ripple?: boolean, o?: MutateOpts) => {
      const targets = ids ?? sel();
      if (!targets.length) return;
      mut((d) => D.deleteClips(d, targets, ripple ?? store.getState().ripple), o);
    },
    /** Duplicate a clip (defaults to the primary selection); the copy becomes the selection. */
    duplicateClip: (id?: string, o?: MutateOpts) => {
      const target = id ?? sel()[sel().length - 1];
      if (!target) return;
      let created: string | undefined;
      mut((d) => {
        const r = D.duplicateClip(d, target);
        created = r.newId;
        return r.doc;
      }, o);
      if (created && !o?.preview) setSel([created]);
      return created;
    },
    toggleClipsMuted: (ids?: string[], o?: MutateOpts) => mut((d) => D.toggleClipsMuted(d, ids ?? sel()), o),

    // ── props / text / effects ──
    updateClipProps: (id: string, patch: Partial<Omit<ClipProps, "keyframes" | "effects" | "text">>, o?: MutateOpts) =>
      mut((d) => D.updateClipProps(d, id, patch), o),
    setClipText: (id: string, patch: Partial<ClipText>, o?: MutateOpts) => mut((d) => D.setClipText(d, id, patch), o),
    addEffect: (clipId: string, type: EffectType, params?: Record<string, number>, o?: MutateOpts) => {
      let effectId = "";
      mut((d) => {
        const r = D.addEffect(d, clipId, type, params);
        effectId = r.effect.id;
        return r.doc;
      }, o);
      return effectId;
    },
    removeEffect: (clipId: string, effectId: string, o?: MutateOpts) => mut((d) => D.removeEffect(d, clipId, effectId), o),
    updateEffect: (clipId: string, effectId: string, params: Record<string, number>, o?: MutateOpts) =>
      mut((d) => D.updateEffect(d, clipId, effectId, params), o),
    toggleEffect: (clipId: string, effectId: string, o?: MutateOpts) => mut((d) => D.toggleEffect(d, clipId, effectId), o),
    reorderEffects: (clipId: string, from: number, to: number, o?: MutateOpts) => mut((d) => D.reorderEffects(d, clipId, from, to), o),

    // ── keyframes ──
    addKeyframe: (clipId: string, channel: Channel, time: number, value: number, easing?: Easing, o?: MutateOpts) => {
      let keyframeId: string | undefined;
      mut((d) => {
        const r = D.addKeyframe(d, clipId, channel, time, value, easing);
        keyframeId = r.keyframeId;
        return r.doc;
      }, o);
      return keyframeId;
    },
    moveKeyframe: (clipId: string, channel: Channel, keyframeId: string, time: number, o?: MutateOpts) =>
      mut((d) => D.moveKeyframe(d, clipId, channel, keyframeId, time), o),
    updateKeyframe: (clipId: string, channel: Channel, keyframeId: string, patch: { value?: number; easing?: Easing }, o?: MutateOpts) =>
      mut((d) => D.updateKeyframe(d, clipId, channel, keyframeId, patch), o),
    removeKeyframe: (clipId: string, channel: Channel, keyframeId: string, o?: MutateOpts) =>
      mut((d) => D.removeKeyframe(d, clipId, channel, keyframeId), o),
    clearChannel: (clipId: string, channel: Channel, o?: MutateOpts) => mut((d) => D.clearChannel(d, clipId, channel), o),
    toggleChannelAnimated: (clipId: string, channel: Channel, time: number, value: number, o?: MutateOpts) =>
      mut((d) => D.toggleChannelAnimated(d, clipId, channel, time, value), o),
    /** Set a channel at clip-relative time: keyframe when animated, static prop otherwise. */
    setChannelValue: (clipId: string, channel: Channel, time: number, value: number, o?: MutateOpts) =>
      mut((d) => D.setChannelValue(d, clipId, channel, time, value), o),

    // ── tracks / bookmarks / project ──
    toggleTrack: (id: string, flag: TrackFlag, o?: MutateOpts) => mut((d) => D.toggleTrack(d, id, flag), o),
    addTrack: (kind: TrackKind, name?: string, index?: number, o?: MutateOpts) => {
      let trackId = "";
      mut((d) => {
        const r = D.addTrack(d, kind, name, index);
        trackId = r.track.id;
        return r.doc;
      }, o);
      return trackId;
    },
    removeTrack: (id: string, o?: MutateOpts) => mut((d) => D.removeTrack(d, id), o),
    /** Returns the bookmark id, or null when one already sits on that frame (nothing changes). */
    addBookmark: (time: number, label?: string, color?: string, o?: MutateOpts): string | null => {
      let id: string | null = null;
      mut((d) => {
        const r = D.addBookmark(d, time, label, color);
        id = r.existed ? null : r.bookmark.id;
        return r.doc;
      }, o);
      return id;
    },
    removeBookmark: (id: string, o?: MutateOpts) => mut((d) => D.removeBookmark(d, id), o),
    renameProject: (name: string, o?: MutateOpts) => mut((d) => (d.project.name === name ? d : { ...d, project: { ...d.project, name } }), o),

    // ── selection (no history) ──
    /** Select one clip; `additive` toggles it within the current selection. */
    select: (id: string, additive = false) => {
      const s = sel();
      setSel(additive ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]);
    },
    setSelection: (ids: string[]) => setSel(ids),
    clearSelection: () => {
      if (sel().length) setSel([]);
    },
    selectAll: () => setSel(store.getState().doc.clips.map((c) => c.id)),

    // ── editing modes / zoom / ui (no history) ──
    setRipple: (ripple: boolean) => store.setState({ ripple }),
    toggleRipple: () => store.setState((s) => ({ ripple: !s.ripple })),
    setSnapping: (snapping: boolean) => store.setState({ snapping }),
    toggleSnapping: () => store.setState((s) => ({ snapping: !s.snapping })),
    /** Set timeline zoom in px/s (clamped). */
    setZoomPps: (pps: number) => store.setState({ zoomPps: Math.min(MAX_ZOOM_PPS, Math.max(MIN_ZOOM_PPS, pps)) }),
    /** Multiply timeline zoom by a factor. */
    zoomBy: (factor: number) => store.setState((s) => ({ zoomPps: Math.min(MAX_ZOOM_PPS, Math.max(MIN_ZOOM_PPS, s.zoomPps * factor)) })),
    /** Zoom so the whole document fits `uiPanels.timelineWidth`. */
    zoomToFit: () =>
      store.setState((s) => {
        const dur = Math.max(1, D.documentDuration(s.doc));
        return { zoomPps: Math.min(MAX_ZOOM_PPS, Math.max(MIN_ZOOM_PPS, (s.uiPanels.timelineWidth - 24) / dur)) };
      }),
    setUi: (patch: Partial<UiState>) => store.setState((s) => ({ uiPanels: { ...s.uiPanels, ...patch } })),
    /** Flip a boolean UI flag. */
    toggleUi: (key: { [K in keyof UiState]: UiState[K] extends boolean ? K : never }[keyof UiState]) =>
      store.setState((s) => ({ uiPanels: { ...s.uiPanels, [key]: !s.uiPanels[key] } })),
    openDialog: (dialog: NonNullable<UiState["dialog"]>) => store.setState((s) => ({ uiPanels: { ...s.uiPanels, dialog } })),
    closeDialog: () => store.setState((s) => (s.uiPanels.dialog ? { uiPanels: { ...s.uiPanels, dialog: null } } : {})),
  };
}
