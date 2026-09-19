/**
 * Pure operations on `ClipProps`: transform values, text, effects and
 * keyframes. Re-exported through document.ts.
 */
import type { Channel, Clip, ClipProps, ClipText, Document, Easing, EffectInstance, EffectType, Keyframe } from "./types";
import { clampChannel, sortKfs } from "./animation";
import { newId } from "./ids";

/** Starting params for each effect type. */
export const EFFECT_DEFAULTS: Record<EffectType, Record<string, number>> = {
  blur: { amount: 8 },
  brightness: { amount: 0 },
  contrast: { amount: 100 },
  saturation: { amount: 100 },
  vignette: { amount: 40 },
  sharpen: { amount: 25 },
};

function mapClip(doc: Document, id: string, fn: (c: Clip) => Clip): Document {
  let changed = false;
  const clips = doc.clips.map((c) => {
    if (c.id !== id) return c;
    const n = fn(c);
    if (n !== c) changed = true;
    return n;
  });
  return changed ? { ...doc, clips } : doc;
}

function mapProps(doc: Document, id: string, fn: (p: ClipProps) => ClipProps): Document {
  return mapClip(doc, id, (c) => {
    const p = fn(c.props);
    return p === c.props ? c : { ...c, props: p };
  });
}

/** Merge a partial patch into the clip's props (clamps animated channels). */
export function updateClipProps(doc: Document, id: string, patch: Partial<Omit<ClipProps, "keyframes" | "effects" | "text">>): Document {
  return mapProps(doc, id, (p) => {
    const next = { ...p, ...patch };
    if (patch.x !== undefined) next.x = clampChannel("x", patch.x);
    if (patch.y !== undefined) next.y = clampChannel("y", patch.y);
    if (patch.scale !== undefined) next.scale = clampChannel("scale", patch.scale);
    if (patch.rotation !== undefined) next.rotation = clampChannel("rotation", patch.rotation);
    if (patch.opacity !== undefined) next.opacity = clampChannel("opacity", patch.opacity);
    return next;
  });
}

/** Patch a text clip's style/content; the clip label follows the content. */
export function setClipText(doc: Document, id: string, patch: Partial<ClipText>): Document {
  return mapClip(doc, id, (c) => {
    if (!c.props.text) return c;
    const text = { ...c.props.text, ...patch };
    return { ...c, label: patch.content !== undefined ? patch.content : c.label, props: { ...c.props, text } };
  });
}

// ── Effects ────────────────────────────────────────────────

/** Append an effect with default params. */
export function addEffect(doc: Document, clipId: string, type: EffectType, params?: Record<string, number>): { doc: Document; effect: EffectInstance } {
  const effect: EffectInstance = { id: newId("e"), type, enabled: true, params: { ...EFFECT_DEFAULTS[type], ...params } };
  return { doc: mapProps(doc, clipId, (p) => ({ ...p, effects: [...p.effects, effect] })), effect };
}

/** Remove an effect by id. */
export function removeEffect(doc: Document, clipId: string, effectId: string): Document {
  return mapProps(doc, clipId, (p) => (p.effects.some((e) => e.id === effectId) ? { ...p, effects: p.effects.filter((e) => e.id !== effectId) } : p));
}

/** Merge params into an effect. */
export function updateEffect(doc: Document, clipId: string, effectId: string, params: Record<string, number>): Document {
  return mapProps(doc, clipId, (p) => ({ ...p, effects: p.effects.map((e) => (e.id === effectId ? { ...e, params: { ...e.params, ...params } } : e)) }));
}

/** Flip an effect's enabled flag. */
export function toggleEffect(doc: Document, clipId: string, effectId: string): Document {
  return mapProps(doc, clipId, (p) => ({ ...p, effects: p.effects.map((e) => (e.id === effectId ? { ...e, enabled: !e.enabled } : e)) }));
}

/** Move an effect from one index to another. */
export function reorderEffects(doc: Document, clipId: string, from: number, to: number): Document {
  return mapProps(doc, clipId, (p) => {
    if (from === to || from < 0 || from >= p.effects.length || to < 0 || to >= p.effects.length) return p;
    const effects = [...p.effects];
    const [moved] = effects.splice(from, 1);
    effects.splice(to, 0, moved);
    return { ...p, effects };
  });
}

// ── Keyframes ──────────────────────────────────────────────

function mapChannel(doc: Document, clipId: string, ch: Channel, fn: (kfs: Keyframe[], clip: Clip) => Keyframe[] | undefined): Document {
  return mapClip(doc, clipId, (c) => {
    const cur = c.props.keyframes[ch] ?? [];
    const next = fn(cur, c);
    if (next === cur) return c;
    const keyframes = { ...c.props.keyframes };
    if (!next || next.length === 0) delete keyframes[ch];
    else keyframes[ch] = next;
    return { ...c, props: { ...c.props, keyframes } };
  });
}

/**
 * Add a keyframe at clip-relative `time`; a keyframe within half a frame is
 * updated in place instead. Easing defaults to the previous keyframe's.
 */
export function addKeyframe(doc: Document, clipId: string, channel: Channel, time: number, value: number, easing?: Easing): { doc: Document; keyframeId?: string } {
  let keyframeId: string | undefined;
  const half = 0.5 / doc.project.fps;
  const v = clampChannel(channel, value);
  const out = mapChannel(doc, clipId, channel, (kfs, clip) => {
    const t = Math.max(0, Math.min(clip.duration, time));
    const hit = kfs.find((k) => Math.abs(k.time - t) < half);
    if (hit) {
      keyframeId = hit.id;
      return kfs.map((k) => (k.id === hit.id ? { ...k, value: v, easing: easing ?? k.easing } : k));
    }
    keyframeId = newId("k");
    const prev = sortKfs(kfs).filter((k) => k.time < t).pop();
    return sortKfs([...kfs, { id: keyframeId, time: t, value: v, easing: easing ?? prev?.easing ?? "ease-in-out" }]);
  });
  return { doc: out, keyframeId };
}

/** Move a keyframe in time (clamped to the clip). */
export function moveKeyframe(doc: Document, clipId: string, channel: Channel, keyframeId: string, time: number): Document {
  return mapChannel(doc, clipId, channel, (kfs, clip) =>
    kfs.some((k) => k.id === keyframeId)
      ? sortKfs(kfs.map((k) => (k.id === keyframeId ? { ...k, time: Math.max(0, Math.min(clip.duration, time)) } : k)))
      : kfs,
  );
}

/** Change a keyframe's value and/or easing. */
export function updateKeyframe(doc: Document, clipId: string, channel: Channel, keyframeId: string, patch: { value?: number; easing?: Easing }): Document {
  return mapChannel(doc, clipId, channel, (kfs) =>
    kfs.some((k) => k.id === keyframeId)
      ? kfs.map((k) => (k.id === keyframeId ? { ...k, ...patch, value: patch.value !== undefined ? clampChannel(channel, patch.value) : k.value } : k))
      : kfs,
  );
}

/** Delete one keyframe; the channel disappears when it was the last. */
export function removeKeyframe(doc: Document, clipId: string, channel: Channel, keyframeId: string): Document {
  return mapChannel(doc, clipId, channel, (kfs) => (kfs.some((k) => k.id === keyframeId) ? kfs.filter((k) => k.id !== keyframeId) : kfs));
}

/** Remove every keyframe of a channel. */
export function clearChannel(doc: Document, clipId: string, channel: Channel): Document {
  return mapChannel(doc, clipId, channel, (kfs) => (kfs.length ? [] : kfs));
}

/**
 * Stopwatch toggle: with no keyframes, animate the channel with one keyframe
 * at `time` holding `value`; with keyframes, freeze the channel at `value`.
 */
export function toggleChannelAnimated(doc: Document, clipId: string, channel: Channel, time: number, value: number): Document {
  const clip = doc.clips.find((c) => c.id === clipId);
  if (!clip) return doc;
  if ((clip.props.keyframes[channel]?.length ?? 0) > 0) {
    const cleared = clearChannel(doc, clipId, channel);
    return channel === "blur" ? cleared : updateClipProps(cleared, clipId, { [channel]: value });
  }
  return addKeyframe(doc, clipId, channel, time, value, "ease-in-out").doc;
}

/**
 * Set a channel's value at `time`: writes a keyframe when the channel is
 * animated, otherwise sets the static prop (or blur effect amount).
 */
export function setChannelValue(doc: Document, clipId: string, channel: Channel, time: number, value: number): Document {
  const clip = doc.clips.find((c) => c.id === clipId);
  if (!clip) return doc;
  if ((clip.props.keyframes[channel]?.length ?? 0) > 0) return addKeyframe(doc, clipId, channel, time, value).doc;
  if (channel !== "blur") return updateClipProps(doc, clipId, { [channel]: value });
  const fx = clip.props.effects.find((e) => e.type === "blur");
  return fx ? updateEffect(doc, clipId, fx.id, { amount: clampChannel("blur", value) }) : addEffect(doc, clipId, "blur", { amount: clampChannel("blur", value) }).doc;
}
