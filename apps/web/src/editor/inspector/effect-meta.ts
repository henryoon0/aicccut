/**
 * Ranges for the one parameter each effect type carries. Starting values come
 * from `EFFECT_DEFAULTS` in the core; these are only the editing ranges.
 */
import type { EffectType } from "#/editor/core";

export interface EffectMeta {
  label: string;
  /** Key inside `EffectInstance.params`. */
  param: string;
  min: number;
  max: number;
  step: number;
  precision: number;
  suffix?: string;
}

export const EFFECT_META: Record<EffectType, EffectMeta> = {
  blur: { label: "Blur", param: "amount", min: 0, max: 64, step: 0.5, precision: 1, suffix: "px" },
  brightness: { label: "Brightness", param: "amount", min: -100, max: 100, step: 1, precision: 0 },
  contrast: { label: "Contrast", param: "amount", min: 0, max: 200, step: 1, precision: 0, suffix: "%" },
  saturation: { label: "Saturation", param: "amount", min: 0, max: 200, step: 1, precision: 0, suffix: "%" },
  vignette: { label: "Vignette", param: "amount", min: 0, max: 100, step: 1, precision: 0, suffix: "%" },
  sharpen: { label: "Sharpen", param: "amount", min: 0, max: 100, step: 1, precision: 0 },
};

/** Effect ids the document model can actually hold. */
export function isEffectType(id: string): id is EffectType {
  return id in EFFECT_META;
}
