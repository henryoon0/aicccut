"use client";

/**
 * Grouped — a fluid segmented Tabs row across the top (All · Edit · Playback
 * · Insert · File · View · Recent) filters the CommandMenu list. Each tab
 * carries its count, ← → switch tabs while the field is empty, and a footer
 * spells out every key the palette understands.
 */

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CommandMenu,
  CommandMenuEmpty,
  CommandMenuFooter,
  CommandMenuInput,
  CommandMenuList,
  type CommandMenuItemData,
} from "#/components/ui/command-menu.tsx";
import { Tabs, TabItem, TabsList } from "#/components/ui/tabs.tsx";
import { Elevated } from "#/lib/elevated.tsx";
import { spring } from "#/lib/springs.ts";
import {
  COMMAND_ITEMS,
  GROUP_ORDER,
  Toast,
  useEditor,
  useEditorShortcuts,
  usePaletteToggle,
  useToast,
} from "./shared";
import { EditorFrame } from "./frame";

const TABS = ["All", ...GROUP_ORDER, "Recent"] as const;
type Tab = (typeof TABS)[number];

export function Grouped() {
  const editor = useEditor();
  const { toast, show } = useToast();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(["split", "add-text", "export"]);

  usePaletteToggle(open, setOpen);
  const runFromFrame = useCallback((id: string) => show(editor.run(id)), [editor.run, show]);
  useEditorShortcuts(!open, runFromFrame);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: COMMAND_ITEMS.length, Recent: recent.length };
    for (const g of GROUP_ORDER) c[g] = COMMAND_ITEMS.filter((i) => i.group === g).length;
    return c;
  }, [recent]);

  // Items follow the tab. In the Recent tab rows lose their group so they
  // list in recency order under one heading.
  const items = useMemo<CommandMenuItemData[]>(() => {
    if (tab === "All") return COMMAND_ITEMS;
    if (tab === "Recent")
      return recent
        .map((id) => COMMAND_ITEMS.find((i) => i.value === id))
        .filter((i): i is CommandMenuItemData => !!i)
        .map((i) => ({ ...i, group: "Recently used" }));
    return COMMAND_ITEMS.filter((i) => i.group === tab);
  }, [tab, recent]);

  const onSelect = (item: CommandMenuItemData) => {
    show(editor.run(item.value));
    setRecent((r) => [item.value, ...r.filter((x) => x !== item.value)].slice(0, 6));
    setOpen(false);
  };

  const step = (dir: 1 | -1) => {
    const i = TABS.indexOf(tab);
    setTab(TABS[(i + dir + TABS.length) % TABS.length]);
  };

  return (
    <EditorFrame editor={editor} onOpenPalette={() => setOpen(true)}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="absolute inset-0 z-40 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
            transition={spring.moderate}
            onPointerDown={() => setOpen(false)}
          />
        )}
        {open && (
          <motion.div
            key="panel"
            className="absolute left-1/2 top-[12%] z-50 w-[580px] max-w-[calc(100%-2rem)]"
            style={{ x: "-50%", transformOrigin: "50% 0%" }}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4, transition: spring.moderate.exit }}
            transition={spring.slow}
          >
            <Elevated offset={4} className="flex max-h-[480px] flex-col overflow-hidden rounded-xl">
              <div className="shrink-0 border-b border-border/60 px-2 pt-2 pb-1.5">
                <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} size="compact">
                  <TabsList className="w-full">
                    {TABS.map((t) => (
                      <TabItem key={t} value={t} label={`${t} ${counts[t] ?? 0}`} className="flex-1 justify-center px-2" />
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <CommandMenu
                items={items}
                onSelect={onSelect}
                query={query}
                onQueryChange={setQuery}
                className="max-h-[420px]"
              >
                <CommandMenuInput
                  autoFocus
                  placeholder={tab === "All" ? "Search all commands…" : `Search ${tab.toLowerCase()}…`}
                  onKeyDown={(e) => {
                    if (query !== "" || e.metaKey || e.ctrlKey || e.altKey) return;
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      step(1);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      step(-1);
                    }
                  }}
                />
                <CommandMenuList className="px-1.5 pb-1.5">
                  <CommandMenuEmpty>
                    {tab === "Recent" ? "Nothing used yet." : `No ${tab === "All" ? "" : tab.toLowerCase() + " "}command matches.`}
                  </CommandMenuEmpty>
                </CommandMenuList>
                <CommandMenuFooter
                  className="border-t border-border/60"
                  hints={[
                    { label: "Move", keys: ["up", "down"] },
                    { label: "Tab", keys: ["left", "right"] },
                    { label: "Run", keys: "enter" },
                    { label: "Close", keys: "esc" },
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
