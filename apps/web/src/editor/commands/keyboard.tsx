"use client";

/**
 * The drawn keyboard on the cheat sheet, plus the key-chip helper both
 * surfaces use. Caps follow the platform: ⌘ ⌥ ⇧ on a Mac, words elsewhere.
 *
 * A key's id is what `parseShortcut(...).key` returns for the combos bound to
 * it, so a command finds its cap without a second table. Shifted punctuation
 * ("?" is Shift+/) is folded back onto the physical key.
 */
import { Kbd, KbdGroup } from "#/components/ui/kbd";
import { COMMAND_LIST, formatShortcut, parseShortcut, type Command } from "#/editor/core";
import { cn } from "#/lib/utils";
import { KEY_LABELS } from "./data";

export interface KeyDef {
  /** Layout id: the lowercase `KeyboardEvent.key` this cap produces. */
  id: string;
  cap: string;
  /** Flex weight in its row. @default 1 */
  units?: number;
  /** Extra space to the left (the navigation cluster). */
  gapBefore?: boolean;
}

export const MODIFIER_IDS = ["meta", "ctrl", "alt", "shift"];

const row = (keys: string[]): KeyDef[] => keys.map((k) => ({ id: k, cap: k.length === 1 ? k.toUpperCase() : k }));

const DIGITS = ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
const ARROWS: KeyDef[] = [
  { id: "arrowleft", cap: "←", units: 0.9, gapBefore: true },
  { id: "arrowup", cap: "↑", units: 0.9 },
  { id: "arrowdown", cap: "↓", units: 0.9 },
  { id: "arrowright", cap: "→", units: 0.9 },
];

/** The five rows to draw, with the caps the platform prints. */
export function keyboardRows(mac: boolean): KeyDef[][] {
  return [
    [
      { id: "escape", cap: "Esc", units: 1.2 },
      ...row(DIGITS),
      { id: "backspace", cap: mac ? "⌫" : "Bksp", units: 1.5 },
      { id: "home", cap: "Home", units: 1.1, gapBefore: true },
      { id: "end", cap: "End", units: 1.1 },
    ],
    [
      { id: "tab", cap: mac ? "⇥" : "Tab", units: 1.5 },
      ...row(["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"]),
    ],
    [
      { id: "capslock", cap: mac ? "⇪" : "Caps", units: 1.8 },
      ...row(["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"]),
      { id: "enter", cap: mac ? "↵" : "Enter", units: 1.7 },
    ],
    [
      { id: "shift", cap: mac ? "⇧" : "Shift", units: 2.3 },
      ...row(["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"]),
      { id: "shift", cap: mac ? "⇧" : "Shift", units: 2.2 },
    ],
    mac
      ? [
          { id: "fn", cap: "fn" },
          { id: "ctrl", cap: "⌃" },
          { id: "alt", cap: "⌥" },
          { id: "meta", cap: "⌘", units: 1.25 },
          { id: " ", cap: "", units: 5 },
          { id: "meta", cap: "⌘", units: 1.25 },
          { id: "alt", cap: "⌥" },
          ...ARROWS,
        ]
      : [
          { id: "ctrl", cap: "Ctrl", units: 1.25 },
          { id: "meta", cap: "Win" },
          { id: "alt", cap: "Alt" },
          { id: " ", cap: "", units: 5 },
          { id: "alt", cap: "Alt" },
          { id: "fn", cap: "Fn" },
          { id: "ctrl", cap: "Ctrl", units: 1.25 },
          ...ARROWS,
        ],
  ];
}

/** Shifted punctuation back to the key it is printed on. */
const PHYSICAL: Record<string, string> = { "?": "/", ":": ";", '"': "'", "+": "=", _: "-", "~": "`" };

/** The layout id a combo lands on. */
export function physicalKey(shortcut: string): string {
  const key = parseShortcut(shortcut).key;
  return PHYSICAL[key] ?? key;
}

/** The modifier keys a combo holds down, as layout ids. */
export function modifierKeys(shortcut: string, mac: boolean): string[] {
  const p = parseShortcut(shortcut);
  const out: string[] = [];
  if (p.mod) out.push(mac ? "meta" : "ctrl");
  if (p.meta) out.push("meta");
  if (p.ctrl) out.push("ctrl");
  if (p.alt) out.push("alt");
  if (p.shift) out.push("shift");
  return out;
}

/** Physical key → the commands whose primary combo ends on it. */
export const COMMANDS_BY_KEY: Record<string, Command[]> = (() => {
  const map: Record<string, Command[]> = {};
  for (const cmd of COMMAND_LIST) {
    if (!cmd.shortcut) continue;
    (map[physicalKey(cmd.shortcut)] ??= []).push(cmd);
  }
  return map;
})();

export interface KeyboardMapProps {
  mac: boolean;
  /** A query or a pinned key is narrowing the list: unlit keys step back. */
  filtering: boolean;
  litKeys: Set<string>;
  hoverKey: string | null;
  /** Modifier ids held by the hovered key's commands. */
  hoverMods: Set<string>;
  pinKey: string | null;
  /** Commands that cannot run right now. */
  disabledIds: Set<string>;
  onHoverKey(key: string | null): void;
  /** A key with one runnable command runs it; anything else pins the key. */
  onActivateKey(key: string): void;
}

/**
 * The keyboard itself. Bound keys carry the command's short word; hovering
 * one lights it and its modifiers, and the sheet highlights the matching rows.
 */
export function KeyboardMap({
  mac, filtering, litKeys, hoverKey, hoverMods, pinKey, disabledIds, onHoverKey, onActivateKey,
}: KeyboardMapProps) {
  return (
    <div className="flex w-full max-w-[800px] flex-col gap-1.5" onMouseLeave={() => onHoverKey(null)}>
      {keyboardRows(mac).map((keys, r) => (
        <div key={r} className="flex gap-1.5">
          {keys.map((k, i) => {
            const cmds = COMMANDS_BY_KEY[k.id] ?? [];
            const runnable = cmds.filter((c) => !disabledIds.has(c.id));
            const bound = cmds.length > 0;
            const isMod = MODIFIER_IDS.includes(k.id);
            const lit = filtering && litKeys.has(k.id);
            const hot = hoverKey === k.id || (isMod && hoverMods.has(k.id));
            const pinned = pinKey === k.id;
            const dim = filtering && !litKeys.has(k.id);
            const off = bound && runnable.length === 0;
            const label = cmds.length === 1 ? KEY_LABELS[cmds[0].id] : `${cmds.length}개`;
            return (
              <button
                key={`${k.id}-${i}`}
                type="button"
                disabled={!bound && !isMod}
                aria-label={bound ? `${k.cap || "Space"}: ${cmds.map((c) => c.label).join(", ")}` : undefined}
                aria-pressed={bound ? pinned : undefined}
                onMouseEnter={() => onHoverKey(k.id)}
                onFocus={() => onHoverKey(k.id)}
                onClick={() => onActivateKey(k.id)}
                className={cn(
                  "relative flex h-12 min-w-0 flex-col items-center justify-center rounded-md text-[12px]",
                  "transition-[background-color,color,opacity,box-shadow] duration-100",
                  k.gapBefore && "ml-4",
                  bound || isMod ? "cursor-pointer" : "cursor-default",
                  bound
                    ? "bg-surface-5 text-foreground shadow-surface-2 hover:bg-surface-6 active:translate-y-px"
                    : "bg-surface-3 text-muted-foreground/60",
                  isMod && !bound && "text-muted-foreground",
                  off && "text-muted-foreground",
                  (lit || pinned) && "bg-surface-7 text-foreground ring-1 ring-foreground/40",
                  hot && "bg-foreground text-background hover:bg-foreground ring-0",
                  dim && !hot && "opacity-40",
                )}
                style={{ flex: k.units ?? 1 }}
              >
                <span className={cn("truncate leading-none", bound && "-translate-y-1")}>{k.cap}</span>
                {bound && (
                  <span className="absolute bottom-1 max-w-full truncate px-0.5 text-[9px] leading-none opacity-70">
                    {label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** A combo drawn as key caps, formatted for the platform. */
export function Keys({ shortcut, mac, className }: { shortcut: string; mac: boolean; className?: string }) {
  return (
    <KbdGroup className={cn("gap-0.5", className)}>
      {formatShortcut(shortcut, mac).map((cap, i) => (
        <Kbd key={i} className="bg-surface-5 text-foreground/80">
          {cap}
        </Kbd>
      ))}
    </KbdGroup>
  );
}
