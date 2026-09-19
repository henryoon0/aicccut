"use client";

/**
 * Learn — teaching first. "?" (or the Shortcuts button) opens a cheat sheet:
 * a drawn keyboard on the left with bound keys labelled, the full command
 * list grouped by area on the right. One search field filters the list and
 * lights the matching keys; hovering a key highlights its commands; clicking
 * a key or a row runs it. ⌘K opens a smaller palette on top of the sheet.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, Search, X } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Kbd } from "#/components/ui/kbd.tsx";
import {
  CommandMenu,
  CommandMenuEmpty,
  CommandMenuFooter,
  CommandMenuInput,
  CommandMenuList,
  parseShortcut,
  useIsMac,
  type CommandMenuItemData,
} from "#/components/ui/command-menu.tsx";
import { Elevated } from "#/lib/elevated.tsx";
import { spring } from "#/lib/springs.ts";
import { cn } from "#/lib/utils.ts";
import { COMMANDS } from "#/prototypes/mock";
import {
  COMMAND_HINTS,
  COMMAND_ITEMS,
  GROUP_ORDER,
  Keys,
  Toast,
  useEditor,
  useEditorShortcuts,
  usePaletteToggle,
  useToast,
  type Command,
} from "./shared";
import { EditorFrame } from "./frame";

/* ─────────────────────── Keyboard layout ─────────────────────── */

interface KeyDef {
  id: string;
  cap: string;
  units?: number;
  gapBefore?: boolean;
}

const ROWS: KeyDef[][] = [
  [
    ...["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="].map((k) => ({ id: k, cap: k })),
    { id: "backspace", cap: "⌫", units: 1.5 },
    { id: "home", cap: "Home", units: 1.25, gapBefore: true },
  ],
  [
    { id: "tab", cap: "⇥", units: 1.5 },
    ...["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"].map((k) => ({ id: k, cap: k.toUpperCase() })),
  ],
  [
    { id: "capslock", cap: "⇪", units: 1.8 },
    ...["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"].map((k) => ({ id: k, cap: k.toUpperCase() })),
    { id: "enter", cap: "↵", units: 1.7 },
  ],
  [
    { id: "shift", cap: "⇧", units: 2.3 },
    ...["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"].map((k) => ({ id: k, cap: k.toUpperCase() })),
    { id: "shift", cap: "⇧", units: 2.2 },
  ],
  [
    { id: "fn", cap: "fn" },
    { id: "ctrl", cap: "⌃" },
    { id: "alt", cap: "⌥" },
    { id: "meta", cap: "⌘", units: 1.25 },
    { id: " ", cap: "", units: 5.5 },
    { id: "meta", cap: "⌘", units: 1.25 },
    { id: "alt", cap: "⌥" },
    { id: "arrowleft", cap: "←" },
    { id: "arrowup", cap: "↑" },
    { id: "arrowright", cap: "→" },
  ],
];

const SHORT: Record<string, string> = {
  split: "Split",
  delete: "Delete",
  ripple: "Ripple",
  undo: "Undo",
  redo: "Redo",
  play: "Play",
  "prev-frame": "Frame",
  "next-frame": "Frame",
  "goto-start": "Start",
  "add-text": "Text",
  "add-effect": "Effect",
  import: "Import",
  export: "Export",
  new: "New",
  "zoom-in": "Zoom",
  "zoom-out": "Zoom",
  fit: "Fit",
  "toggle-snap": "Snap",
  "safe-areas": "Safe",
  bookmark: "Mark",
};

/** Physical key → commands whose combo ends on it. */
const BY_KEY: Record<string, Command[]> = {};
for (const cmd of COMMANDS) {
  const key = parseShortcut(cmd.shortcut).key;
  (BY_KEY[key] ??= []).push(cmd);
}

function modifiersOf(cmd: Command, mac: boolean): Set<string> {
  const p = parseShortcut(cmd.shortcut);
  const s = new Set<string>();
  if (p.mod) s.add(mac ? "meta" : "ctrl");
  if (p.meta) s.add("meta");
  if (p.ctrl) s.add("ctrl");
  if (p.alt) s.add("alt");
  if (p.shift) s.add("shift");
  return s;
}

/* ─────────────────────── Component ─────────────────────── */

export function Learn() {
  const editor = useEditor();
  const { toast, show } = useToast();
  const mac = useIsMac();
  const [sheet, setSheet] = useState(true);
  const [palette, setPalette] = useState(true);
  const [query, setQuery] = useState("");
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinKey, setPinKey] = useState<string | null>(null);

  const onEscape = useCallback(() => {
    if (palette) setPalette(false);
    else if (pinKey) setPinKey(null);
    else if (sheet) setSheet(false);
  }, [palette, pinKey, sheet]);
  usePaletteToggle(palette, setPalette, onEscape);

  const runFromFrame = useCallback((id: string) => show(editor.run(id)), [editor.run, show]);
  useEditorShortcuts(!palette && !sheet, runFromFrame);

  // "?" opens the sheet from the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      if (e.key === "?" && !palette) {
        e.preventDefault();
        setSheet(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palette]);

  const run = (id: string) => show(editor.run(id));

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    let list = COMMANDS;
    if (pinKey) list = list.filter((c) => parseShortcut(c.shortcut).key === pinKey);
    if (q)
      list = list.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q) ||
          (COMMAND_HINTS[c.id] ?? "").toLowerCase().includes(q) ||
          c.shortcut.toLowerCase().includes(q)
      );
    return list;
  }, [q, pinKey]);
  const matchIds = useMemo(() => new Set(matches.map((c) => c.id)), [matches]);
  const filtering = q !== "" || pinKey !== null;

  // Keys to light: the key caps and modifiers of every listed command.
  const litKeys = useMemo(() => {
    const s = new Set<string>();
    for (const c of matches) {
      s.add(parseShortcut(c.shortcut).key);
      for (const m of modifiersOf(c, mac)) s.add(m);
    }
    return s;
  }, [matches, mac]);
  const hoverCmds = hoverKey ? (BY_KEY[hoverKey] ?? []) : [];
  const hoverIds = new Set(hoverCmds.map((c) => c.id));
  const hoverMods = new Set(hoverCmds.flatMap((c) => [...modifiersOf(c, mac)]));

  const onPaletteSelect = (item: CommandMenuItemData) => {
    run(item.value);
    setPalette(false);
  };

  return (
    <EditorFrame
      editor={editor}
      onOpenPalette={() => setPalette(true)}
      topRight={
        <Button variant="secondary" size="compact" leadingIcon={Keyboard} onClick={() => setSheet(true)} className="shrink-0">
          <span className="flex items-center gap-2 whitespace-nowrap">
            Shortcuts
            <Kbd className="-mr-1 bg-surface-5 text-foreground/80">?</Kbd>
          </span>
        </Button>
      }
    >
      <AnimatePresence>
        {sheet && (
          <motion.div
            key="sheet-scrim"
            className="absolute inset-0 z-40 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            transition={spring.moderate}
            onPointerDown={() => setSheet(false)}
          />
        )}
        {sheet && (
          <motion.div
            key="sheet"
            className="absolute inset-5 z-40"
            initial={{ opacity: 0, scale: 0.985, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 6, transition: spring.moderate.exit }}
            transition={spring.slow}
          >
            <Elevated offset={4} className="flex h-full flex-col overflow-hidden rounded-xl">
              <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-4">
                <Keyboard size={16} strokeWidth={1.5} className="text-muted-foreground" />
                <span className="text-[13px] font-medium">Keyboard shortcuts</span>
                <span className="text-[11px] text-muted-foreground">{COMMANDS.length} commands</span>
                <label className="ml-3 flex h-8 w-72 items-center gap-2 rounded-md bg-surface-2 px-2.5 ring-1 ring-border/60 focus-within:ring-foreground/30">
                  <Search size={13} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                  <input
                    autoFocus={!palette}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && query !== "") {
                        e.preventDefault();
                        setQuery("");
                      }
                    }}
                    placeholder="Filter by name, area or key…"
                    spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
                  />
                  {query && (
                    <span className="text-[10px] tabular-nums text-muted-foreground">{matches.length}</span>
                  )}
                </label>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Run a command by name <Keys shortcut="mod+k" />
                </span>
                <Button variant="ghost" size="icon-compact" aria-label="Close" onClick={() => setSheet(false)}>
                  <X />
                </Button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex min-h-0 flex-col items-center justify-center gap-4 border-r border-border/60 px-6 py-5">
                  <div className="flex w-full max-w-[720px] flex-col gap-1.5" onMouseLeave={() => setHoverKey(null)}>
                    {ROWS.map((row, r) => (
                      <div key={r} className="flex gap-1.5">
                        {row.map((k, i) => {
                          const cmds = BY_KEY[k.id] ?? [];
                          const bound = cmds.length > 0;
                          const isMod = ["meta", "ctrl", "alt", "shift"].includes(k.id);
                          const lit = filtering && litKeys.has(k.id);
                          const hot = hoverKey === k.id || (isMod && hoverMods.has(k.id));
                          const pinned = pinKey === k.id;
                          const dim = filtering && !litKeys.has(k.id);
                          return (
                            <button
                              key={`${k.id}-${i}`}
                              type="button"
                              disabled={!bound && !isMod}
                              onMouseEnter={() => setHoverKey(k.id)}
                              onClick={() => {
                                if (cmds.length === 1 && !pinned) run(cmds[0].id);
                                else setPinKey(pinned ? null : k.id);
                              }}
                              className={cn(
                                "relative flex h-11 flex-col items-center justify-center rounded-md text-[12px] transition-[background-color,color,transform] duration-100",
                                k.gapBefore && "ml-4",
                                bound || isMod ? "cursor-pointer" : "cursor-default",
                                bound
                                  ? "bg-surface-5 text-foreground shadow-surface-2 hover:bg-surface-6 active:translate-y-px"
                                  : "bg-surface-3 text-muted-foreground/60",
                                isMod && !bound && "text-muted-foreground",
                                (lit || pinned) && "bg-emerald-500/20 text-emerald-600 ring-1 ring-emerald-500/60 dark:text-emerald-300",
                                hot && "bg-foreground text-background hover:bg-foreground",
                                dim && !hot && "opacity-40"
                              )}
                              style={{ flex: k.units ?? 1 }}
                            >
                              <span className={cn("leading-none", bound && "-translate-y-1")}>{k.cap}</span>
                              {bound && (
                                <span className="absolute bottom-1 text-[8px] uppercase tracking-wide opacity-70">
                                  {cmds.length === 1 ? SHORT[cmds[0].id] : `${cmds.length} cmds`}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {hoverKey && hoverCmds.length > 0 ? (
                      <>
                        <span className="text-foreground">{hoverCmds.map((c) => c.label).join(" · ")}</span>
                        {hoverCmds.length > 1 ? " — click the key to list them" : " — click the key to run it"}
                      </>
                    ) : pinKey ? (
                      <>
                        Showing commands on <span className="text-foreground">{pinKey.toUpperCase()}</span>. Press Esc to
                        clear.
                      </>
                    ) : (
                      "Labelled keys are bound. Hover a key to see its command; type above to light the keys you need."
                    )}
                  </p>
                </div>

                <div className="min-h-0 overflow-y-auto px-2 py-2">
                  {GROUP_ORDER.map((g) => {
                    const rows = matches.filter((c) => c.group === g);
                    if (rows.length === 0) return null;
                    return (
                      <div key={g} className="mb-2">
                        <div className="flex h-7 items-center px-2 text-[11px] font-medium text-muted-foreground">{g}</div>
                        {rows.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => run(c.id)}
                            onMouseEnter={() => setHoverKey(parseShortcut(c.shortcut).key)}
                            onMouseLeave={() => setHoverKey(null)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover",
                              hoverIds.has(c.id) && "bg-hover",
                              filtering && !matchIds.has(c.id) && "opacity-40"
                            )}
                          >
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-[12px] text-foreground">{c.label}</span>
                              <span className="truncate text-[11px] text-muted-foreground">{COMMAND_HINTS[c.id]}</span>
                            </span>
                            <Keys shortcut={c.shortcut} />
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  {matches.length === 0 && (
                    <div className="px-2 py-8 text-center text-[12px] text-muted-foreground">No shortcut matches.</div>
                  )}
                </div>
              </div>
            </Elevated>
          </motion.div>
        )}

        {palette && (
          <motion.div
            key="palette-scrim"
            className="absolute inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            transition={spring.moderate}
            onPointerDown={() => setPalette(false)}
          />
        )}
        {palette && (
          <motion.div
            key="palette"
            className="absolute left-1/2 top-[16%] z-[55] w-[480px] max-w-[calc(100%-2rem)]"
            style={{ x: "-50%", transformOrigin: "50% 0%" }}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4, transition: spring.moderate.exit }}
            transition={spring.slow}
          >
            <Elevated offset={sheet ? 2 : 4} className="flex max-h-[380px] flex-col overflow-hidden rounded-xl">
              <CommandMenu items={COMMAND_ITEMS} onSelect={onPaletteSelect} size="compact" className="max-h-[380px]">
                <CommandMenuInput autoFocus placeholder="Run a command…" />
                <CommandMenuList className="px-1 pb-1">
                  <CommandMenuEmpty>No command matches.</CommandMenuEmpty>
                </CommandMenuList>
                <CommandMenuFooter
                  className="border-t border-border/60"
                  hints={[
                    { label: "Move", keys: ["up", "down"] },
                    { label: "Run", keys: "enter" },
                    { label: "Back", keys: "esc" },
                  ]}
                />
              </CommandMenu>
            </Elevated>
          </motion.div>
        )}
      </AnimatePresence>
      <Toast toast={toast} />
    </EditorFrame>
  );
}
