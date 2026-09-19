"use client";

/**
 * CommandPalette — ⌘K over everything. The rows are `COMMAND_LIST`: labels,
 * platform-formatted combos, groups, and a disabled row wherever the command
 * says it cannot run. With nothing typed the recently run commands lead.
 *
 * The root stays mounted for the toast host (sonner needs one `<Toaster/>`
 * somewhere, and this area owns the confirmations); the palette surface below
 * it exists only while `uiPanels.palette` is on.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CommandMenu, CommandMenuEmpty, CommandMenuFooter, CommandMenuInput, CommandMenuList,
  type CommandMenuItemData,
} from "#/components/ui/command-menu";
import { Toaster } from "#/components/ui/sonner";
import { COMMAND_LIST, useActions, useCommandContext, useEditor } from "#/editor/core";
import { Elevated } from "#/lib/elevated";
import { spring } from "#/lib/springs";
import { COMMAND_ICONS } from "./data";
import { isEnabled, loadRecent, useRunCommand } from "./run";

/** The toast host plus the palette surface. Renders no panel while closed. */
export function CommandPalette() {
  const open = useEditor((s) => s.uiPanels.palette);
  return (
    <>
      <Toaster position="bottom-right" />
      <AnimatePresence>{open && <PaletteSurface key="command-palette" />}</AnimatePresence>
    </>
  );
}

/** Keys the field answers itself, so the global listener never sees them. */
const OWNED_KEYS = new Set(["Escape", "Enter", "ArrowUp", "ArrowDown", "Home", "End"]);

function PaletteSurface() {
  const actions = useActions();
  const ctx = useCommandContext();
  const run = useRunCommand();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  // Read once as the palette opens: the list is a convenience, and a later
  // render would reset the highlight under the cursor.
  const [recent] = useState(loadRecent);

  const close = useCallback(() => actions.setUi({ palette: false }), [actions]);

  // Everything `enabled` reads, as one string: a change here re-derives the
  // rows, nothing else does.
  const gate = useEditor(
    (s) => `${s.selection.clipIds.length}|${s.history.past.length}|${s.history.future.length}|${s.uiPanels.dialog ?? ""}`,
  );
  const items = useMemo<CommandMenuItemData[]>(() => {
    void gate;
    return COMMAND_LIST.map((c) => ({
      value: c.id,
      label: c.label,
      shortcut: c.shortcut,
      group: c.group,
      icon: COMMAND_ICONS[c.id],
      keywords: [c.group, ...(c.keywords ?? [])],
      disabled: !isEnabled(c, ctx),
    }));
  }, [ctx, gate]);

  const onSelect = useCallback(
    (item: CommandMenuItemData) => {
      close();
      run(item.value);
    },
    [close, run],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (OWNED_KEYS.has(e.key)) e.stopPropagation();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (query !== "") setQuery("");
        else close();
      }
    },
    [close, query],
  );

  // Esc from outside the field (a stray focus) still closes the palette, and
  // capture keeps core's Escape command from clearing the selection under it.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (rootRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  return (
    <>
      <motion.div
        key="palette-scrim"
        className="fixed inset-0 z-[60] bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: spring.moderate.exit }}
        transition={spring.moderate}
        onPointerDown={close}
      />
      <motion.div
        key="palette"
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed left-1/2 top-[16%] z-[61] w-[480px] max-w-[calc(100vw-2rem)]"
        style={{ x: "-50%", transformOrigin: "50% 0%" }}
        initial={{ opacity: 0, scale: 0.97, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -4, transition: spring.moderate.exit }}
        transition={spring.slow}
      >
        <Elevated offset={4} className="flex max-h-[380px] flex-col overflow-hidden rounded-xl">
          <CommandMenu
            items={items}
            onSelect={onSelect}
            query={query}
            onQueryChange={setQuery}
            suggestions={recent}
            suggestionsLabel="Recent"
            size="compact"
            className="max-h-[380px]"
          >
            <CommandMenuInput autoFocus placeholder="Run a command…" onKeyDown={onKeyDown} />
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
    </>
  );
}
