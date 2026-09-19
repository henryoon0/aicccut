/**
 * Font catalogue for the browser. The seed `FONTS` list is expanded into a
 * 1,000+ entry catalogue of named cuts so the browser feels like a real font
 * library; every entry falls back to its base family for rendering.
 */
import { FONTS } from "#/editor/core";

export type FontCategory = "Sans" | "Serif" | "Display" | "Mono" | "Korean";

export interface FontEntry {
  /** Stable id (slug of the name). */
  id: string;
  /** Display name, also the value stored on the clip. */
  name: string;
  /** Family the browser actually tries to render. */
  family: string;
  category: FontCategory;
  /** Pseudo-random but stable style count, so rows differ. */
  styles: number;
}

const KOREAN = new Set([
  "Pretendard", "Noto Sans KR", "Gothic A1", "Nanum Myeongjo", "Nanum Gothic", "Black Han Sans",
  "Do Hyeon", "Jua", "Gowun Dodum", "Gowun Batang", "Hahmlet", "Song Myung", "Sunflower", "Poor Story",
]);
const SERIF = new Set(["Playfair Display", "Fraunces", "Lora", "Instrument Serif", "Nanum Myeongjo", "Gowun Batang", "Hahmlet", "Song Myung"]);
const MONO = new Set(["IBM Plex Mono", "JetBrains Mono", "Geist Mono"]);
const DISPLAY = new Set(["Bricolage Grotesque", "Black Han Sans", "Do Hyeon", "Jua", "Poor Story", "Sora", "Outfit"]);

/** Bucket a base family by name. */
export function categoryOf(name: string): FontCategory {
  if (KOREAN.has(name) && !SERIF.has(name) && !DISPLAY.has(name)) return "Korean";
  if (MONO.has(name)) return "Mono";
  if (SERIF.has(name)) return "Serif";
  if (DISPLAY.has(name)) return "Display";
  return "Sans";
}

const SUFFIXES = [
  "", "Text", "Display", "Condensed", "Narrow", "Tight", "Wide", "Rounded", "Expanded", "Compact",
  "Headline", "Caption", "Semi Condensed", "Extra Condensed", "Book", "Poster", "Micro", "Variable",
  "Neue", "Classic", "Modern", "Slab", "Mono", "Script", "Stencil", "Outline", "Inline", "Shadow",
  "Italic Pro", "SC", "Deck", "Banner", "Subhead", "Fine", "Grand", "Petit",
];

function buildCatalogue(): FontEntry[] {
  const out: FontEntry[] = [];
  for (const base of FONTS) {
    const cat = categoryOf(base);
    for (const suffix of SUFFIXES) {
      const name = suffix ? `${base} ${suffix}` : base;
      const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
      out.push({
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        family: base,
        category: suffix === "Mono" ? "Mono" : cat,
        styles: 1 + (seed % 9),
      });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export const FONT_CATALOGUE: FontEntry[] = buildCatalogue();
export const FONT_BY_NAME = new Map(FONT_CATALOGUE.map((f) => [f.name, f]));

/** CSS font-family stack for a catalogue name (falls back to the system stack). */
export function fontFamilyFor(name: string): string {
  const f = FONT_BY_NAME.get(name);
  return `"${f?.family ?? name}", "Pretendard", "Inter Variable", system-ui, sans-serif`;
}

export const CATEGORY_TINT: Record<FontCategory, string> = {
  Sans: "#5b6cff",
  Serif: "#f4a261",
  Display: "#ff6b6b",
  Mono: "#2ec4b6",
  Korean: "#c77dff",
};
