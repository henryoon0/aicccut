/**
 * Pure editing operations on a `Document`. Every function returns a new
 * document (or the same reference when nothing changed) and never mutates
 * its input, so callers can diff by identity and history can store snapshots.
 *
 * Invariants kept by every operation:
 *  - `inPoint >= 0`, and `inPoint + duration <= asset.duration` for media clips
 *  - `duration >= minDuration(doc)` (2 frames)
 *  - clips on one track never overlap
 *  - times are snapped to the project frame grid
 */
import type { Asset, AssetKind, Bookmark, Clip, Document, Edge, Track, TrackFlag, TrackKind } from "./types";
import { defaultClipProps, DEFAULT_TEXT_STYLE, TINTS } from "./seed";
import { newId } from "./ids";

/** Korean display names used when a track is created without a name. */
const TRACK_KIND_LABEL: Record<TrackKind, string> = { video: "비디오", audio: "오디오", text: "텍스트", effect: "효과" };

export * from "./clip-props";

const EPS = 1e-6;
/** Timeline length images and text get when dropped. */
export const DEFAULT_STILL_DURATION = 5;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const endOf = (c: Clip) => c.start + c.duration;

/** Seconds per frame for the document's project. */
export const frameDuration = (doc: Document) => 1 / doc.project.fps;
/** Shortest clip allowed: 2 frames. */
export const minDuration = (doc: Document) => 2 * frameDuration(doc);

/** Round a time to the nearest frame. */
export function snapToFrame(t: number, fps: number): number {
  return Math.round(t * fps) / fps;
}
const snapD = (doc: Document, t: number) => snapToFrame(t, doc.project.fps);

/** Clip by id, or undefined. */
export const clipById = (doc: Document, id: string) => doc.clips.find((c) => c.id === id);
/** Track by id, or undefined. */
export const trackById = (doc: Document, id: string) => doc.tracks.find((t) => t.id === id);
/** Asset by id, or undefined. */
export const assetById = (doc: Document, id: string) => doc.assets.find((a) => a.id === id);

/** Source length in seconds; Infinity for images, text and effects. */
export function sourceDuration(doc: Document, c: Clip): number {
  const a = c.assetId ? assetById(doc, c.assetId) : undefined;
  return a && a.duration > 0 ? a.duration : Infinity;
}
/** Whether the clip has a finite source it can slip within. */
export const canSlip = (doc: Document, c: Clip) => Number.isFinite(sourceDuration(doc, c));

/** Clips on a track, ordered by start. */
export function trackClips(doc: Document, trackId: string, clips: Clip[] = doc.clips): Clip[] {
  return clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
}

/** Previous and next clip on the same track. */
export function neighbors(doc: Document, c: Clip, clips: Clip[] = doc.clips): { prev?: Clip; next?: Clip } {
  const lane = trackClips(doc, c.trackId, clips);
  const i = lane.findIndex((x) => x.id === c.id);
  return { prev: lane[i - 1], next: lane[i + 1] };
}

/** Track kind a clip of the given asset kind (or none, for text/effect) belongs on. */
export function trackKindFor(assetKind: AssetKind | undefined, fallback: TrackKind = "video"): TrackKind {
  if (assetKind === "audio") return "audio";
  if (assetKind === "video" || assetKind === "image") return "video";
  return fallback;
}

/** Track kind the clip lives on now. */
export function clipTrackKind(doc: Document, c: Clip): TrackKind {
  const t = trackById(doc, c.trackId);
  if (t) return t.kind;
  return trackKindFor(c.assetId ? assetById(doc, c.assetId)?.kind : undefined, c.props.text ? "text" : "effect");
}

/** Clips intersecting time t (start inclusive, end exclusive). */
export function clipsAt(doc: Document, t: number): Clip[] {
  return doc.clips.filter((c) => t >= c.start - EPS && t < endOf(c) - EPS);
}

/** End of the last clip, or 0. */
export function documentDuration(doc: Document): number {
  return doc.clips.reduce((m, c) => Math.max(m, endOf(c)), 0);
}

function withClips(doc: Document, clips: Clip[]): Document {
  return clips === doc.clips ? doc : { ...doc, clips };
}

function shiftTrackAfter(doc: Document, clips: Clip[], trackId: string, from: number, delta: number, exceptId?: string): Clip[] {
  if (Math.abs(delta) < EPS) return clips;
  return clips.map((x) =>
    x.trackId === trackId && x.id !== exceptId && x.start >= from - EPS ? { ...x, start: snapD(doc, x.start + delta) } : x,
  );
}

/** Place `clip` on its track; clips it would overlap (and everything after them) move right to make room. */
function insertPushingRight(doc: Document, clips: Clip[], clip: Clip): Clip[] {
  const lane = trackClips(doc, clip.trackId, clips).filter((x) => x.id !== clip.id && endOf(x) > clip.start + EPS);
  if (!lane.length) return [...clips, clip];
  const delta = endOf(clip) - lane[0].start;
  const shifted = delta > EPS ? shiftTrackAfter(doc, clips, clip.trackId, lane[0].start, delta, clip.id) : clips;
  return [...shifted, clip];
}

// ── Assets ─────────────────────────────────────────────────

/** Append an asset (id/addedAt/tint are filled in when missing). */
export function addAsset(doc: Document, input: Omit<Asset, "id" | "addedAt" | "tint"> & Partial<Pick<Asset, "id" | "addedAt" | "tint">>): { doc: Document; asset: Asset } {
  const asset: Asset = {
    ...input,
    id: input.id ?? newId("a"),
    addedAt: input.addedAt ?? new Date().toISOString(),
    tint: input.tint ?? TINTS[doc.assets.length % TINTS.length],
  };
  return { doc: { ...doc, assets: [...doc.assets, asset] }, asset };
}

/** Remove an asset and every clip that uses it. */
export function removeAsset(doc: Document, assetId: string): Document {
  if (!assetById(doc, assetId)) return doc;
  return { ...doc, assets: doc.assets.filter((a) => a.id !== assetId), clips: doc.clips.filter((c) => c.assetId !== assetId) };
}

// ── Clips: insert / move ───────────────────────────────────

function firstFreeTrack(doc: Document, kind: TrackKind, start: number, duration: number): Track | undefined {
  const candidates = doc.tracks.filter((t) => t.kind === kind && !t.locked);
  const free = candidates.find((t) => !trackClips(doc, t.id).some((c) => c.start < start + duration - EPS && endOf(c) > start + EPS));
  return free ?? candidates[0] ?? doc.tracks.find((t) => t.kind === kind);
}

/**
 * Add a clip for an asset at `start`. `trackId: "auto"` picks the first
 * kind-compatible track with room (else the first compatible track);
 * overlapping clips are pushed right.
 */
export function addClipFromAsset(doc: Document, assetId: string, trackId: string | "auto", start: number): { doc: Document; clip?: Clip } {
  const asset = assetById(doc, assetId);
  if (!asset) return { doc };
  const duration = asset.duration > 0 ? asset.duration : DEFAULT_STILL_DURATION;
  const s = Math.max(0, snapD(doc, start));
  const kind = trackKindFor(asset.kind);
  const track = trackId === "auto" ? firstFreeTrack(doc, kind, s, duration) : trackById(doc, trackId);
  if (!track || track.kind !== kind) return { doc };
  const clip: Clip = {
    id: newId("c"), trackId: track.id, assetId, label: asset.name.replace(/\.[^.]+$/, ""),
    start: s, duration: snapD(doc, duration), inPoint: 0, tint: asset.tint, props: defaultClipProps(),
  };
  return { doc: withClips(doc, insertPushingRight(doc, doc.clips, clip)), clip };
}

/** Add a text clip on the first unlocked text track (created when missing). */
export function addTextClip(doc: Document, start: number, content = "새 텍스트", duration = DEFAULT_STILL_DURATION): { doc: Document; clip?: Clip } {
  let d = doc;
  let track = d.tracks.find((t) => t.kind === "text" && !t.locked);
  if (!track) {
    const r = addTrack(d, "text", "텍스트");
    d = r.doc;
    track = r.track;
  }
  const clip: Clip = {
    id: newId("c"), trackId: track.id, label: content, start: Math.max(0, snapD(d, start)), duration: snapD(d, duration), inPoint: 0,
    tint: "#ffd166", props: { ...defaultClipProps(), text: { ...DEFAULT_TEXT_STYLE, content } },
  };
  return { doc: withClips(d, insertPushingRight(d, d.clips, clip)), clip };
}

/**
 * Move a clip to `start` (and optionally another track of the same kind).
 * The clip is clamped into the free gap around the requested start; when no
 * gap fits, the document is returned unchanged.
 */
export function moveClip(doc: Document, id: string, start: number, trackId?: string): Document {
  const c = clipById(doc, id);
  if (!c) return doc;
  const targetId = trackId ?? c.trackId;
  const target = trackById(doc, targetId);
  if (!target || target.kind !== clipTrackKind(doc, c) || target.locked) return doc;
  const requested = Math.max(0, snapD(doc, start));
  const lane = trackClips(doc, targetId).filter((x) => x.id !== id);
  const prev = [...lane].reverse().find((x) => x.start <= requested + EPS);
  const next = lane.find((x) => x.start > requested + EPS);
  const lo = prev ? endOf(prev) : 0;
  const hi = next ? next.start : Infinity;
  if (hi - lo < c.duration - EPS) return doc;
  const ns = snapD(doc, clamp(requested, lo, hi - c.duration));
  if (Math.abs(ns - c.start) < EPS && targetId === c.trackId) return doc;
  return withClips(doc, doc.clips.map((x) => (x.id === id ? { ...x, start: ns, trackId: targetId } : x)));
}

// ── Clips: trim / slip / roll ──────────────────────────────

/** Trim one edge by `delta` seconds. Respects inPoint ≥ 0, source length and neighbours; ripple closes the gap. */
export function trimClip(doc: Document, id: string, edge: Edge, delta: number, ripple: boolean): Document {
  const c = clipById(doc, id);
  if (!c || Math.abs(delta) < EPS) return doc;
  const MIN = minDuration(doc);
  const { prev, next } = neighbors(doc, c);
  const src = sourceDuration(doc, c);
  if (edge === "start") {
    const minStart = Math.max(c.start - c.inPoint, ripple ? -Infinity : prev ? endOf(prev) : 0, ripple ? -Infinity : 0);
    const ns = clamp(snapD(doc, c.start + delta), minStart, endOf(c) - MIN);
    const d = ns - c.start;
    if (Math.abs(d) < EPS) return doc;
    const updated: Clip = { ...c, start: ripple ? c.start : ns, inPoint: snapD(doc, c.inPoint + d), duration: snapD(doc, c.duration - d) };
    const out = doc.clips.map((x) => (x.id === id ? updated : x));
    return withClips(doc, ripple ? shiftTrackAfter(doc, out, c.trackId, endOf(c), -d, id) : out);
  }
  const maxDur = Math.min(src - c.inPoint, ripple || !next ? Infinity : next.start - c.start);
  const nd = clamp(snapD(doc, c.duration + delta), MIN, maxDur);
  const d = nd - c.duration;
  if (Math.abs(d) < EPS) return doc;
  const out = doc.clips.map((x) => (x.id === id ? { ...x, duration: nd } : x));
  return withClips(doc, ripple ? shiftTrackAfter(doc, out, c.trackId, endOf(c), d, id) : out);
}

/** Slide the source window without moving the clip. */
export function slipClip(doc: Document, id: string, delta: number): Document {
  const c = clipById(doc, id);
  if (!c || !canSlip(doc, c)) return doc;
  const ni = clamp(snapD(doc, c.inPoint + delta), 0, sourceDuration(doc, c) - c.duration);
  if (Math.abs(ni - c.inPoint) < EPS) return doc;
  return withClips(doc, doc.clips.map((x) => (x.id === id ? { ...x, inPoint: ni } : x)));
}

/** Move the cut between two adjacent clips; total length stays the same. */
export function rollCut(doc: Document, leftId: string, rightId: string, delta: number): Document {
  const l = clipById(doc, leftId);
  const r = clipById(doc, rightId);
  if (!l || !r) return doc;
  const MIN = minDuration(doc);
  const lo = Math.max(MIN - l.duration, -r.inPoint);
  const hi = Math.min(sourceDuration(doc, l) - l.inPoint - l.duration, r.duration - MIN);
  const d = clamp(snapD(doc, delta), lo, hi);
  if (Math.abs(d) < EPS) return doc;
  return withClips(doc, doc.clips.map((x) => {
    if (x.id === leftId) return { ...x, duration: snapD(doc, x.duration + d) };
    if (x.id === rightId) return { ...x, start: snapD(doc, x.start + d), inPoint: snapD(doc, x.inPoint + d), duration: snapD(doc, x.duration - d) };
    return x;
  }));
}

// ── Clips: split / delete / duplicate ──────────────────────

function splitKeyframes(c: Clip, cut: number): { left: Clip["props"]["keyframes"]; right: Clip["props"]["keyframes"] } {
  const left: Clip["props"]["keyframes"] = {};
  const right: Clip["props"]["keyframes"] = {};
  for (const [ch, kfs] of Object.entries(c.props.keyframes) as [keyof Clip["props"]["keyframes"], Clip["props"]["keyframes"][keyof Clip["props"]["keyframes"]]][]) {
    if (!kfs) continue;
    left[ch] = kfs.filter((k) => k.time <= cut);
    right[ch] = kfs.filter((k) => k.time > cut).map((k) => ({ ...k, id: newId("k"), time: k.time - cut }));
  }
  return { left, right };
}

/** Split every listed clip that crosses `t`. Returns the ids of the right-hand halves. */
export function splitClips(doc: Document, ids: string[], t: number): { doc: Document; rightIds: string[] } {
  const MIN = minDuration(doc);
  const rightIds: string[] = [];
  const out: Clip[] = [];
  for (const c of doc.clips) {
    if (ids.includes(c.id) && t > c.start + MIN - EPS && t < endOf(c) - MIN + EPS) {
      const cut = snapD(doc, t);
      const kf = splitKeyframes(c, cut - c.start);
      const right: Clip = {
        ...c, id: newId("c"), start: cut, duration: snapD(doc, endOf(c) - cut), inPoint: snapD(doc, c.inPoint + (cut - c.start)),
        props: { ...c.props, keyframes: kf.right, effects: c.props.effects.map((e) => ({ ...e, id: newId("e") })) },
      };
      out.push({ ...c, duration: snapD(doc, cut - c.start), props: { ...c.props, keyframes: kf.left } }, right);
      rightIds.push(right.id);
    } else out.push(c);
  }
  return rightIds.length ? { doc: withClips(doc, out), rightIds } : { doc, rightIds };
}

/** Delete clips; with `ripple`, later clips on the same track close the gap. */
export function deleteClips(doc: Document, ids: string[], ripple: boolean): Document {
  let cur = doc.clips;
  const order = [...ids].sort((a, b) => (clipById(doc, a)?.start ?? 0) - (clipById(doc, b)?.start ?? 0));
  for (const id of order) {
    const c = cur.find((x) => x.id === id);
    if (!c) continue;
    cur = cur.filter((x) => x.id !== id);
    if (ripple) cur = shiftTrackAfter(doc, cur, c.trackId, endOf(c), -c.duration);
  }
  return withClips(doc, cur);
}

/** Copy a clip right after itself, pushing later clips on the track. */
export function duplicateClip(doc: Document, id: string): { doc: Document; newId?: string } {
  const c = clipById(doc, id);
  if (!c) return { doc };
  const copy: Clip = { ...c, id: newId("c"), start: endOf(c), props: { ...c.props, effects: c.props.effects.map((e) => ({ ...e, id: newId("e") })) } };
  const shifted = shiftTrackAfter(doc, doc.clips, c.trackId, endOf(c), c.duration, id);
  return { doc: withClips(doc, [...shifted, copy]), newId: copy.id };
}

/** Flip `muted` on the listed clips. */
export function toggleClipsMuted(doc: Document, ids: string[]): Document {
  if (!ids.length) return doc;
  return withClips(doc, doc.clips.map((x) => (ids.includes(x.id) ? { ...x, muted: !x.muted } : x)));
}

// ── Tracks ─────────────────────────────────────────────────

/** Flip one boolean flag on a track. */
export function toggleTrack(doc: Document, id: string, flag: TrackFlag): Document {
  const t = trackById(doc, id);
  if (!t) return doc;
  return { ...doc, tracks: doc.tracks.map((x) => (x.id === id ? { ...x, [flag]: !x[flag] } : x)) };
}

/** Insert a track; `index` defaults to just above the first track of the same kind (or the end). */
export function addTrack(doc: Document, kind: TrackKind, name?: string, index?: number): { doc: Document; track: Track } {
  const count = doc.tracks.filter((t) => t.kind === kind).length;
  const label = name ?? `${TRACK_KIND_LABEL[kind]} ${count + 1}`;
  const track: Track = { id: newId("t"), name: label, kind, muted: false, locked: false, hidden: false };
  const firstOfKind = doc.tracks.findIndex((t) => t.kind === kind);
  const at = index ?? (firstOfKind === -1 ? doc.tracks.length : firstOfKind);
  const tracks = [...doc.tracks];
  tracks.splice(clamp(at, 0, tracks.length), 0, track);
  return { doc: { ...doc, tracks }, track };
}

/** Remove a track and its clips. */
export function removeTrack(doc: Document, id: string): Document {
  if (!trackById(doc, id)) return doc;
  return { ...doc, tracks: doc.tracks.filter((t) => t.id !== id), clips: doc.clips.filter((c) => c.trackId !== id) };
}

// ── Bookmarks ──────────────────────────────────────────────

/** Add a bookmark at `time`. */
export function addBookmark(doc: Document, time: number, label = "", color = "#ffd166"): { doc: Document; bookmark: Bookmark } {
  const bookmark: Bookmark = { id: newId("b"), time: Math.max(0, snapD(doc, time)), label, color };
  return { doc: { ...doc, bookmarks: [...doc.bookmarks, bookmark].sort((a, b) => a.time - b.time) }, bookmark };
}

/** Remove a bookmark by id. */
export function removeBookmark(doc: Document, id: string): Document {
  if (!doc.bookmarks.some((b) => b.id === id)) return doc;
  return { ...doc, bookmarks: doc.bookmarks.filter((b) => b.id !== id) };
}

// ── Snapping ───────────────────────────────────────────────

/** Sorted, de-duplicated times a drag should snap to: 0, playhead, clip edges and bookmarks. */
export function snapCandidates(doc: Document, excludeIds: string[] = [], playhead?: number): number[] {
  const set = new Set<number>([0]);
  if (playhead !== undefined) set.add(playhead);
  for (const c of doc.clips) {
    if (excludeIds.includes(c.id)) continue;
    set.add(c.start);
    set.add(endOf(c));
  }
  for (const b of doc.bookmarks) set.add(b.time);
  return [...set].sort((a, b) => a - b);
}

/** Nearest candidate within `threshold` seconds of t, else t itself. */
export function snapTime(t: number, candidates: number[], threshold: number): { time: number; snapped: boolean } {
  let best: number | undefined;
  let dist = threshold;
  for (const c of candidates) {
    const d = Math.abs(c - t);
    if (d <= dist) {
      dist = d;
      best = c;
    }
  }
  return best === undefined ? { time: t, snapped: false } : { time: best, snapped: true };
}
