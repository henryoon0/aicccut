/**
 * Ranges for the one parameter each effect type carries. Starting values come
 * from `EFFECT_DEFAULTS` in the core; these are only the editing ranges.
 */
import { EFFECTS, type EffectType } from "#/editor/core";

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
  blur: { label: "블러", param: "amount", min: 0, max: 64, step: 0.5, precision: 1, suffix: "px" },
  brightness: { label: "밝기", param: "amount", min: -100, max: 100, step: 1, precision: 0 },
  contrast: { label: "대비", param: "amount", min: 0, max: 200, step: 1, precision: 0, suffix: "%" },
  saturation: { label: "채도", param: "amount", min: 0, max: 200, step: 1, precision: 0, suffix: "%" },
  vignette: { label: "비네트", param: "amount", min: 0, max: 100, step: 1, precision: 0, suffix: "%" },
  sharpen: { label: "선명도", param: "amount", min: 0, max: 100, step: 1, precision: 0 },
};

type CatalogueId = (typeof EFFECTS)[number]["id"];

/**
 * Korean name and one-line description for every catalogue entry, keyed by
 * id so the core's `EFFECTS` copy stays untouched. Covers the two entries the
 * document model cannot hold yet (chroma, lut) as well.
 */
export const EFFECT_COPY: Record<CatalogueId, { name: string; description: string }> = {
  blur: { name: "블러", description: "가우시안 블러, 0~64px" },
  brightness: { name: "밝기", description: "-100 ~ +100" },
  contrast: { name: "대비", description: "0~200%" },
  saturation: { name: "채도", description: "0~200%" },
  vignette: { name: "비네트", description: "가장자리 어둡게" },
  chroma: { name: "크로마 키", description: "특정 색상 제거" },
  lut: { name: "LUT", description: ".cube 색 보정 파일 적용" },
  sharpen: { name: "선명도", description: "0~100" },
};

/** Effect ids the document model can actually hold. */
export function isEffectType(id: string): id is EffectType {
  return id in EFFECT_META;
}
