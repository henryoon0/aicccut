"use client";

/**
 * Spotlight — one big centered field, results grouped under headings, recent
 * commands first. The fluid CommandMenu is the engine; the shell is ours so
 * the panel sits inside the editor frame.
 */

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CommandMenu,
  CommandMenuEmpty,
  CommandMenuFooter,
  CommandMenuInput,
  CommandMenuList,
  CommandMenuShortcut,
  type CommandMenuItemData,
} from "#/components/ui/command-menu.tsx";
import { Elevated } from "#/lib/elevated.tsx";
import { spring } from "#/lib/springs.ts";
import {
  COMMAND_ITEMS,
  Toast,
  useEditor,
  useEditorShortcuts,
  usePaletteToggle,
  useToast,
} from "./shared";
import { EditorFrame } from "./frame";

export function Spotlight() {
  const editor = useEditor();
  const { toast, show } = useToast();
  const [open, setOpen] = useState(true);
  const [recent, setRecent] = useState<string[]>(["split", "play", "export"]);

  usePaletteToggle(open, setOpen);
  const runFromFrame = useCallback((id: string) => show(editor.run(id)), [editor.run, show]);
  useEditorShortcuts(!open, runFromFrame);

  const onSelect = (item: CommandMenuItemData) => {
    show(editor.run(item.value));
    setRecent((r) => [item.value, ...r.filter((x) => x !== item.value)].slice(0, 4));
    setOpen(false);
  };

  return (
    <EditorFrame editor={editor} onOpenPalette={() => setOpen(true)}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="absolute inset-0 z-40 bg-black/50"
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
            className="absolute left-1/2 top-[14%] z-50 w-[640px] max-w-[calc(100%-2rem)]"
            style={{ x: "-50%", transformOrigin: "50% 0%" }}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4, transition: spring.moderate.exit }}
            transition={spring.slow}
          >
            <Elevated
              offset={4}
              className="flex max-h-[460px] flex-col overflow-hidden rounded-2xl ring-1 ring-white/5"
            >
              <CommandMenu
                items={COMMAND_ITEMS}
                onSelect={onSelect}
                suggestions={recent}
                suggestionsLabel="Recent"
                className="max-h-[460px]"
              >
                <CommandMenuInput
                  autoFocus
                  placeholder="What do you want to do?"
                  className="h-16 !text-[18px] font-medium tracking-tight placeholder:font-normal"
                />
                <CommandMenuList className="px-2 pb-2">
                  <CommandMenuEmpty>
                    No command matches. Try “split”, “zoom” or “export”.
                  </CommandMenuEmpty>
                </CommandMenuList>
                <CommandMenuFooter className="border-t border-border/60">
                  <span className="flex items-center gap-1.5">
                    Move <CommandMenuShortcut keys={["up", "down"]} className="ml-0" />
                  </span>
                  <span className="flex items-center gap-1.5">
                    Run <CommandMenuShortcut keys="enter" className="ml-0" />
                  </span>
                  <span className="flex items-center gap-1.5">
                    Close <CommandMenuShortcut keys="esc" className="ml-0" />
                  </span>
                  <span className="ml-auto text-muted-foreground/70">
                    Shortcuts shown on the right work anywhere in the editor
                  </span>
                </CommandMenuFooter>
              </CommandMenu>
            </Elevated>
          </motion.div>
        )}
      </AnimatePresence>
      <Toast toast={toast} />
    </EditorFrame>
  );
}
