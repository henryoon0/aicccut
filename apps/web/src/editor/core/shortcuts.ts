/**
 * Keyboard shortcut parsing, matching and display. Copied from
 * components/ui/command-menu.tsx so the core has no UI dependency.
 * Format: tokens joined by "+", e.g. "Mod+Shift+Z", "Space", "ArrowLeft", "=".
 */

export interface ParsedShortcut {
  /** ⌘ on a Mac, Ctrl elsewhere (matches either). */
  mod: boolean;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** Lowercase `KeyboardEvent.key` ("k", "/", "escape"). */
  key: string;
}

const MODIFIER_TOKENS: Record<string, keyof Omit<ParsedShortcut, "key">> = {
  mod: "mod", cmd: "meta", command: "meta", meta: "meta", win: "meta", super: "meta",
  ctrl: "ctrl", control: "ctrl", alt: "alt", option: "alt", opt: "alt", shift: "shift",
};

/** Named keys, as `KeyboardEvent.key` spells them (lowercased). */
const KEY_ALIASES: Record<string, string> = {
  esc: "escape", return: "enter", space: " ", spacebar: " ",
  up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", del: "delete", plus: "+",
};

/** Splits a combo on "+", keeping a trailing "+" as the key itself. */
function shortcutTokens(shortcut: string): string[] {
  const trimmed = shortcut.trim();
  if (trimmed === "") return [];
  const tokens = trimmed.split("+").map((t) => t.trim());
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "" && i > 0) {
      if (out[out.length - 1] !== "+") out.push("+");
      continue;
    }
    if (tokens[i] !== "") out.push(tokens[i]);
  }
  return out;
}

/** Parse "Mod+Shift+Z" into modifier flags and a lowercase key. */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parsed: ParsedShortcut = { mod: false, meta: false, ctrl: false, alt: false, shift: false, key: "" };
  for (const token of shortcutTokens(shortcut)) {
    const lower = token.toLowerCase();
    const modifier = MODIFIER_TOKENS[lower];
    if (modifier) parsed[modifier] = true;
    else parsed.key = KEY_ALIASES[lower] ?? lower;
  }
  return parsed;
}

export type KeyLike = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

/** Whether a keydown is the parsed combo. Shift is only checked when the combo names it. */
export function matchesShortcut(e: KeyLike, parsed: ParsedShortcut): boolean {
  if (parsed.key === "") return false;
  const key = e.key.toLowerCase();
  const byCode =
    parsed.key.length === 1 &&
    /[a-z0-9]/.test(parsed.key) &&
    (e.altKey || !/^[a-z0-9]$/i.test(e.key)) &&
    e.code.toLowerCase() === (/[a-z]/.test(parsed.key) ? `key${parsed.key}` : `digit${parsed.key}`);
  if (key !== parsed.key && !byCode) return false;
  if (parsed.mod) {
    if (!e.metaKey && !e.ctrlKey) return false;
  } else if (e.metaKey !== parsed.meta || e.ctrlKey !== parsed.ctrl) {
    return false;
  }
  if (e.altKey !== parsed.alt) return false;
  if (parsed.shift && !e.shiftKey) return false;
  return true;
}

/** Whether the combo holds any modifier (i.e. is safe to fire while typing). */
export function hasModifier(parsed: ParsedShortcut): boolean {
  return parsed.mod || parsed.meta || parsed.ctrl || parsed.alt;
}

/** Number of modifiers named; used to prefer "Shift+ArrowLeft" over "ArrowLeft". */
export function shortcutSpecificity(parsed: ParsedShortcut): number {
  return Number(parsed.mod) + Number(parsed.meta) + Number(parsed.ctrl) + Number(parsed.alt) + Number(parsed.shift);
}

const CAP_LABELS: Record<string, { mac: string; other: string }> = {
  mod: { mac: "⌘", other: "Ctrl" }, meta: { mac: "⌘", other: "Win" }, ctrl: { mac: "⌃", other: "Ctrl" },
  alt: { mac: "⌥", other: "Alt" }, shift: { mac: "⇧", other: "Shift" }, enter: { mac: "↵", other: "Enter" },
  escape: { mac: "Esc", other: "Esc" }, backspace: { mac: "⌫", other: "Backspace" }, delete: { mac: "⌦", other: "Del" },
  tab: { mac: "⇥", other: "Tab" }, " ": { mac: "Space", other: "Space" },
  arrowup: { mac: "↑", other: "↑" }, arrowdown: { mac: "↓", other: "↓" }, arrowleft: { mac: "←", other: "←" }, arrowright: { mac: "→", other: "→" },
  home: { mac: "Home", other: "Home" }, end: { mac: "End", other: "End" },
};

const PREFORMATTED = /^[⌘⌃⌥⇧↵⌫⌦⇥↑↓←→]+[A-Za-z0-9]?$/;

/** Key caps to display, in order: modifiers as symbols on a Mac and words elsewhere. */
export function formatShortcut(shortcut: string, mac: boolean): string[] {
  const caps: string[] = [];
  for (const token of shortcutTokens(shortcut)) {
    if (PREFORMATTED.test(token)) {
      caps.push(...Array.from(token));
      continue;
    }
    const lower = token.toLowerCase();
    const modifier = MODIFIER_TOKENS[lower];
    const name = modifier ?? (KEY_ALIASES[lower] ?? lower);
    const cap = CAP_LABELS[name];
    if (cap) caps.push(mac ? cap.mac : cap.other);
    else if (name.length === 1) caps.push(name.toUpperCase());
    else caps.push(name.charAt(0).toUpperCase() + name.slice(1));
  }
  return caps;
}

/** Whether the page runs on a Mac (draws ⌘ / ⌥). False on the server. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** True when the event target is an input, textarea, select or contenteditable. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
}
