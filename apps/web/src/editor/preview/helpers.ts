/**
 * Pure CSS helpers for the compositor. Everything here works in *canvas
 * pixels* (the project's own coordinate system); the stage applies one
 * `scale()` on top, so nothing below has to know about zoom.
 */
import { useEffect, useLayoutEffect, type CSSProperties } from "react";
import { evaluateClip, type ChannelValues, type Clip, type Project, type TextStyle } from "#/editor/core";

/** Text sizes are authored against a 1920-wide frame and scale with the project. */
export const REFERENCE_WIDTH = 1920;

/** Padding kept around the frame when fitting it to the viewport. */
export const FIT_PADDING = 24;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `useLayoutEffect` on the client, `useEffect` on the server (no SSR warning). */
export const useIsoLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

/** Scale that fits a `w × h` frame inside a `bw × bh` box, with padding. */
export function fitScale(bw: number, bh: number, w: number, h: number, pad = FIT_PADDING): number {
  if (w <= 0 || h <= 0) return 1;
  return Math.max(0.02, Math.min((bw - pad * 2) / w, (bh - pad * 2) / h));
}

/** `uiPanels.previewZoom` as a plain multiplier. */
export function zoomScale(zoom: number | "fit", fit: number): number {
  return zoom === "fit" ? fit : Math.max(0.02, zoom / 100);
}

// ── Per-clip CSS ───────────────────────────────────────────

/** `mix-blend-mode` for a clip's blend prop ("Color Dodge" → "color-dodge"). */
export function blendMode(clip: Clip): CSSProperties["mixBlendMode"] {
  const v = clip.props.blend.toLowerCase().replace(/\s+/g, "-");
  return (v === "normal" ? undefined : v) as CSSProperties["mixBlendMode"];
}

/**
 * Transform from the evaluated channels. Media layers cover the whole frame
 * and rotate about their centre; text layers hang off the frame centre and
 * need the extra half-size shift.
 */
export function layerTransform(v: ChannelValues, centred: boolean): string {
  const head = centred ? "translate(-50%, -50%) " : "";
  return `${head}translate(${v.x.toFixed(2)}px, ${v.y.toFixed(2)}px) rotate(${v.rotation.toFixed(2)}deg) scale(${(v.scale / 100).toFixed(4)})`;
}

/**
 * CSS `filter` for a clip. `blur` comes from the evaluated blur channel (which
 * already folds in the blur effect and its keyframes), so the effects list
 * only contributes the colour operations.
 */
export function clipFilter(clip: Clip, blur: number): string {
  const parts: string[] = [];
  if (blur > 0.05) parts.push(`blur(${blur.toFixed(2)}px)`);
  for (const fx of clip.props.effects) {
    if (!fx.enabled) continue;
    const amount = fx.params.amount ?? 0;
    if (fx.type === "brightness") parts.push(`brightness(${clamp(1 + amount / 100, 0, 3).toFixed(3)})`);
    else if (fx.type === "contrast") parts.push(`contrast(${clamp(amount, 0, 300).toFixed(0)}%)`);
    else if (fx.type === "saturation") parts.push(`saturate(${clamp(amount, 0, 300).toFixed(0)}%)`);
    else if (fx.type === "sharpen") parts.push(`contrast(${clamp(100 + amount * 0.4, 100, 200).toFixed(0)}%)`);
  }
  return parts.join(" ");
}

/** Strength of an enabled vignette, 0 when the clip has none. */
export function vignetteAmount(clip: Clip): number {
  const fx = clip.props.effects.find((e) => e.type === "vignette" && e.enabled);
  return fx ? clamp(fx.params.amount ?? 0, 0, 100) : 0;
}

/** Combined filter of every clip on an effect track — it applies to the layers below. */
export function stackFilter(clips: Clip[], t: number): string {
  return clips
    .map((c) => clipFilter(c, evaluateClip(c, t).blur))
    .filter(Boolean)
    .join(" ");
}

/** Deterministic gradient standing in for a clip with no decoded file. */
export function tintBackground(clip: Clip, t: number): string {
  const tint = /^#[0-9a-f]{6}$/i.test(clip.tint) ? clip.tint : "#1f2937";
  const local = t - clip.start;
  const angle = 120 + Math.sin(local * 0.6) * 25;
  const pos = 50 + Math.sin(local * 0.9) * 20;
  return `radial-gradient(ellipse at ${pos.toFixed(1)}% 35%, ${tint}cc 0%, transparent 55%), linear-gradient(${angle.toFixed(1)}deg, ${tint} 0%, #0b1020 100%)`;
}

// ── Text ───────────────────────────────────────────────────

/** Typographic CSS for a text clip, in canvas pixels. */
export function textStyle(style: TextStyle, project: Project): CSSProperties {
  return {
    fontFamily: `"${style.font}", "Pretendard", "Inter Variable", sans-serif`,
    fontSize: style.size * (project.width / REFERENCE_WIDTH),
    fontWeight: style.weight,
    fontStyle: style.italic ? "italic" : "normal",
    letterSpacing: `${style.tracking / 100}em`,
    lineHeight: style.leading / 100,
    color: style.color,
    textAlign: style.align,
    textShadow: "0 2px 12px rgba(0,0,0,.45)",
  };
}
