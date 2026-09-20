/**
 * Catalogue for the font browser: the core font library, one row per real
 * family. Rendering and loading come from core so the preview stays in sync.
 */
import { FONT_LIBRARY, fontStackFor, type FontCategory, type FontFamily } from "#/editor/core";

export type { FontCategory };

export interface FontEntry extends FontFamily {
  /** Stable id (slug of the name). */
  id: string;
}

export const FONT_CATALOGUE: FontEntry[] = [...FONT_LIBRARY]
  .map((f) => ({ ...f, id: f.name.toLowerCase().replace(/\s+/g, "-") }))
  .sort((a, b) => a.name.localeCompare(b.name));
export const FONT_BY_NAME = new Map(FONT_CATALOGUE.map((f) => [f.name, f]));

/** CSS font-family stack for a catalogue name. */
export const fontFamilyFor = fontStackFor;

export const CATEGORY_LABEL: Record<FontCategory, string> = {
  Korean: "한글",
  Sans: "고딕",
  Serif: "명조",
  Display: "디스플레이",
  Mono: "고정폭",
};

export const CATEGORY_TINT: Record<FontCategory, string> = {
  Sans: "#5b6cff",
  Serif: "#f4a261",
  Display: "#ef476f",
  Mono: "#2ec4b6",
  Korean: "#c77dff",
};
