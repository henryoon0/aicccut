/**
 * The font library: real families only. Pretendard and Inter ship with the
 * app; everything else is a Google Fonts family fetched on demand the first
 * time it is previewed or applied, so the browser can show many styles
 * without downloading them all up front.
 */
export type FontCategory = "Sans" | "Serif" | "Display" | "Mono" | "Korean";

export interface FontFamily {
  /** Display name, also the value stored on a clip. */
  name: string;
  category: FontCategory;
}

/** Families bundled with the app (no network needed). */
export const BUNDLED_FONTS = new Set(["Pretendard", "Inter"]);

const K = (names: string[]): FontFamily[] => names.map((name) => ({ name, category: "Korean" }));
const S = (names: string[]): FontFamily[] => names.map((name) => ({ name, category: "Sans" }));
const SE = (names: string[]): FontFamily[] => names.map((name) => ({ name, category: "Serif" }));
const D = (names: string[]): FontFamily[] => names.map((name) => ({ name, category: "Display" }));
const M = (names: string[]): FontFamily[] => names.map((name) => ({ name, category: "Mono" }));

export const FONT_LIBRARY: readonly FontFamily[] = [
  ...K([
    "Pretendard", "Noto Sans KR", "Noto Serif KR", "Nanum Gothic", "Nanum Myeongjo", "Nanum Gothic Coding",
    "Nanum Pen Script", "Nanum Brush Script", "Gothic A1", "IBM Plex Sans KR", "Gowun Dodum", "Gowun Batang",
    "Hahmlet", "Song Myung", "Black Han Sans", "Do Hyeon", "Jua", "Poor Story", "Gugi", "Gaegu", "Hi Melody",
    "Stylish", "Single Day", "Yeon Sung", "Kirang Haerang", "East Sea Dokdo", "Cute Font", "Dokdo",
    "Gamja Flower", "Black And White Picture", "Gasoek One", "Orbit", "Diphylleia",
  ]),
  ...S([
    "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Nunito", "Nunito Sans", "Raleway",
    "Work Sans", "DM Sans", "Manrope", "Sora", "Outfit", "Space Grotesk", "IBM Plex Sans", "Source Sans 3",
    "Rubik", "Karla", "Mulish", "Figtree", "Plus Jakarta Sans", "Urbanist", "Lexend", "Onest", "Geist",
    "Archivo", "Barlow", "Cabin", "Josefin Sans", "Quicksand", "Public Sans", "Red Hat Display", "Albert Sans",
    "Be Vietnam Pro", "Hanken Grotesk", "Schibsted Grotesk", "Instrument Sans", "Bricolage Grotesque", "Syne",
  ]),
  ...SE([
    "Playfair Display", "Lora", "Merriweather", "Fraunces", "Instrument Serif", "EB Garamond",
    "Cormorant Garamond", "Libre Baskerville", "Crimson Pro", "Source Serif 4", "Spectral", "DM Serif Display",
    "DM Serif Text", "Newsreader", "Literata", "Noto Serif", "Bitter", "Zilla Slab", "Roboto Slab", "Arvo", "Domine",
  ]),
  ...D([
    "Bebas Neue", "Anton", "Oswald", "Abril Fatface", "Righteous", "Bangers", "Lobster", "Pacifico",
    "Permanent Marker", "Caveat", "Dancing Script", "Satisfy", "Alfa Slab One", "Archivo Black",
    "Big Shoulders Display", "Unbounded", "Rubik Mono One", "Bungee", "Fredoka", "Baloo 2",
  ]),
  ...M([
    "JetBrains Mono", "IBM Plex Mono", "Fira Code", "Source Code Pro", "Roboto Mono", "Space Mono", "Geist Mono",
    "DM Mono", "Inconsolata", "Ubuntu Mono", "Courier Prime",
  ]),
];

export const FONT_BY_NAME: ReadonlyMap<string, FontFamily> = new Map(FONT_LIBRARY.map((f) => [f.name, f]));

/** CSS font-family stack for a family name; unknown names still get the app fallbacks. */
export function fontStackFor(name: string): string {
  const family = BUNDLED_FONTS.has(name) && name === "Pretendard" ? "Pretendard Variable" : name === "Inter" ? "Inter Variable" : name;
  return `"${family}", "Pretendard Variable", "Inter Variable", system-ui, sans-serif`;
}

const requested = new Set<string>();

/**
 * Load a Google Fonts family once. Asks for regular + bold first; families
 * that lack a 700 cut make the CSS request fail, so the plain family (regular
 * only, bold synthesised) is requested as a fallback. No-op for bundled fonts
 * and outside the browser.
 */
export function ensureFontLoaded(name: string): void {
  if (typeof document === "undefined" || !name || BUNDLED_FONTS.has(name) || requested.has(name)) return;
  requested.add(name);
  const family = encodeURIComponent(name).replace(/%20/g, "+");
  const add = (query: string, onError?: () => void) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
    link.dataset.font = name;
    if (onError) link.onerror = () => { link.remove(); onError(); };
    document.head.appendChild(link);
  };
  add(`${family}:wght@400;700`, () => add(family));
}
