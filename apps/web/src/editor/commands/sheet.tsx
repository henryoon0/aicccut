"use client";

/**
 * ShortcutsSheet — the cheat sheet behind "?". A drawn keyboard on the left
 * with every bound key labelled, the full command list grouped by area on the
 * right. One field filters the list and lights the matching keys; hovering a
 * key highlights its commands; clicking a key runs it (or pins it when the key
 * carries several). ⌘K opens the palette on top.
 *
 * Esc peels one layer at a time: the typed query, then a pinned key, then the
 * sheet. The palette peels first and handles its own Esc, so this listener
 * stands down while it is open.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, Search, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  COMMAND_LIST, commandsByGroup, isMacPlatform, useActions, useCommandContext, useEditor, type Command,
} from "#/editor/core";
import { Elevated } from "#/lib/elevated";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { COMMAND_HINTS, groupLabel } from "./data";
import { COMMANDS_BY_KEY, KeyboardMap, Keys, modifierKeys, physicalKey } from "./keyboard";
import { isEnabled, useRunCommand } from "./run";

/** Open state only; the surface below owns the rest so it costs nothing closed. */
export function ShortcutsSheet() {
  const open = useEditor((s) => s.uiPanels.cheatsheet);
  return <AnimatePresence>{open && <SheetSurface key="shortcuts-sheet" />}</AnimatePresence>;
}

function matchesQuery(cmd: Command, q: string): boolean {
  if (q === "") return true;
  const haystack = [cmd.label, cmd.group, groupLabel(cmd.group), COMMAND_HINTS[cmd.id] ?? "", cmd.shortcut ?? "", ...(cmd.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function SheetSurface() {
  const actions = useActions();
  const ctx = useCommandContext();
  const store = ctx.store;
  const run = useRunCommand();

  const [mac, setMac] = useState(false);
  const [query, setQuery] = useState("");
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinKey, setPinKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMac(isMacPlatform()), []);

  const close = useCallback(() => actions.setUi({ cheatsheet: false }), [actions]);
  const openPalette = useCallback(() => actions.setUi({ palette: true }), [actions]);

  // Enablement is recomputed whenever the inputs every `enabled` predicate
  // reads can have changed.
  const gate = useEditor(
    (s) => `${s.selection.clipIds.length}|${s.history.past.length}|${s.history.future.length}|${s.uiPanels.dialog ?? ""}`,
  );
  const disabledIds = useMemo(() => {
    void gate;
    return new Set(COMMAND_LIST.filter((c) => !isEnabled(c, ctx)).map((c) => c.id));
  }, [ctx, gate]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    let list = COMMAND_LIST;
    if (pinKey) list = list.filter((c) => c.shortcut && physicalKey(c.shortcut) === pinKey);
    return list.filter((c) => matchesQuery(c, q));
  }, [q, pinKey]);
  const filtering = q !== "" || pinKey !== null;

  // Keys to light: the cap and the modifiers of every command still listed.
  const litKeys = useMemo(() => {
    const s = new Set<string>();
    for (const c of matches) {
      if (!c.shortcut) continue;
      s.add(physicalKey(c.shortcut));
      for (const m of modifierKeys(c.shortcut, mac)) s.add(m);
    }
    return s;
  }, [matches, mac]);

  const hoverCmds = hoverKey ? (COMMANDS_BY_KEY[hoverKey] ?? []) : [];
  const hoverIds = new Set(hoverCmds.map((c) => c.id));
  const hoverMods = new Set(hoverCmds.flatMap((c) => (c.shortcut ? modifierKeys(c.shortcut, mac) : [])));

  const onActivateKey = useCallback(
    (key: string) => {
      const cmds = (COMMANDS_BY_KEY[key] ?? []).filter((c) => !disabledIds.has(c.id));
      if (pinKey === key) setPinKey(null);
      else if (cmds.length === 1) run(cmds[0].id);
      else if (COMMANDS_BY_KEY[key]?.length) setPinKey(key);
    },
    [disabledIds, pinKey, run],
  );

  // Esc peels a layer. Capture, so core's Escape command (clear selection)
  // never sees the press: it checks `defaultPrevented`.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (store.getState().uiPanels.palette) return;
      if (e.target === searchRef.current && query !== "") return;
      e.preventDefault();
      e.stopPropagation();
      if (pinKey) setPinKey(null);
      else close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [store, query, pinKey, close]);

  return (
    <>
      <motion.div
        key="sheet-scrim"
        className="fixed inset-0 z-50 bg-black/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: spring.moderate.exit }}
        transition={spring.moderate}
        onPointerDown={close}
      />
      <motion.div
        key="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="단축키"
        className="fixed inset-0 z-50 grid place-items-center p-5"
        initial={{ opacity: 0, scale: 0.985, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.99, y: 6, transition: spring.moderate.exit }}
        transition={spring.slow}
      >
        <Elevated
          offset={4}
          className="pointer-events-auto flex h-full max-h-[680px] w-full max-w-[1180px] flex-col overflow-hidden rounded-xl"
        >
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-4">
            <Keyboard size={16} strokeWidth={1.5} className="text-muted-foreground" />
            <span className="text-[13px] font-medium">단축키</span>
            <span className="text-[11px] text-muted-foreground">명령 {COMMAND_LIST.length}개</span>
            <label className="ml-3 flex h-8 w-72 items-center gap-2 rounded-md bg-surface-2 px-2.5 ring-1 ring-border/60 focus-within:ring-foreground/30">
              <Search size={13} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                    e.preventDefault();
                    e.stopPropagation();
                    openPalette();
                    return;
                  }
                  if (e.key === "Escape" && query !== "") {
                    e.preventDefault();
                    e.stopPropagation();
                    setQuery("");
                  }
                }}
                placeholder="이름·영역·키로 찾기…"
                spellCheck={false}
                aria-label="단축키 찾기"
                className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
              />
              {query !== "" && <span className="text-[10px] tabular-nums text-muted-foreground">{matches.length}</span>}
            </label>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
              명령 이름으로 실행 <Keys shortcut="Mod+K" mac={mac} />
            </span>
            <Button variant="ghost" size="icon-compact" aria-label="닫기" onClick={close}>
              <X />
            </Button>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px]">
            <section className="flex min-h-0 flex-col items-center justify-center gap-4 border-r border-border/60 px-6 py-5">
              <KeyboardMap
                mac={mac}
                filtering={filtering}
                litKeys={litKeys}
                hoverKey={hoverKey}
                hoverMods={hoverMods}
                pinKey={pinKey}
                disabledIds={disabledIds}
                onHoverKey={setHoverKey}
                onActivateKey={onActivateKey}
              />
              <p className="max-w-[720px] text-center text-[11px] text-muted-foreground">
                {hoverKey && hoverCmds.length > 0 ? (
                  <>
                    <span className="text-foreground">{hoverCmds.map((c) => c.label).join(" · ")}</span>
                    {hoverCmds.length > 1 ? " · 키를 클릭하면 목록이 나옵니다" : " · 키를 클릭하면 실행됩니다"}
                  </>
                ) : pinKey ? (
                  <>
                    <span className="text-foreground">{pinKey.toUpperCase()}</span> 키의 명령만 보고 있습니다. Esc를
                    누르면 해제됩니다.
                  </>
                ) : (
                  "글자가 있는 키에 명령이 있습니다. 키에 마우스를 올리면 명령이 보이고, 위에서 검색하면 해당 키가 켜집니다."
                )}
              </p>
            </section>

            <section className="min-h-0 overflow-y-auto px-2 py-2">
              {commandsByGroup(matches).map(({ group, commands }) => (
                <div key={group} className="mb-2">
                  <div className="flex h-7 items-center px-2 text-[11px] font-medium text-muted-foreground">{groupLabel(group)}</div>
                  {commands.map((c) => {
                    const off = disabledIds.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={off}
                        onClick={() => run(c.id)}
                        onMouseEnter={() => setHoverKey(c.shortcut ? physicalKey(c.shortcut) : null)}
                        onMouseLeave={() => setHoverKey(null)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                          // A disabled row still teaches, so it fades rather than disappears.
                          off ? "cursor-default opacity-55" : "hover:bg-hover",
                          !off && hoverIds.has(c.id) && "bg-hover",
                        )}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-[12px] text-foreground">{c.label}</span>
                          <span className="truncate text-[11px] text-muted-foreground">{COMMAND_HINTS[c.id]}</span>
                        </span>
                        {c.shortcut && <Keys shortcut={c.shortcut} mac={mac} />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {matches.length === 0 && (
                <div className="px-2 py-8 text-center text-[12px] text-muted-foreground">일치하는 단축키가 없습니다.</div>
              )}
            </section>
          </div>
        </Elevated>
      </motion.div>
    </>
  );
}
