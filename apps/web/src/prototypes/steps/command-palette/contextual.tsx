"use client";

/**
 * Contextual — the empty palette shows what fits the moment: with a clip
 * selected, Split / Delete / Ripple / Add effect lead, with a line saying
 * why; with nothing selected, Import / Add text / Export lead. Typing drops
 * the context and searches everything. The first time a command runs from
 * the palette, the confirmation adds "Next time press S".
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MousePointer2 } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import {
  CommandMenu,
  CommandMenuEmpty,
  CommandMenuFooter,
  CommandMenuInput,
  CommandMenuList,
  type CommandMenuItemData,
} from "#/components/ui/command-menu.tsx";
import { Elevated } from "#/lib/elevated.tsx";
import { spring } from "#/lib/springs.ts";
import { CLIPS } from "#/prototypes/mock";
import {
  COMMAND_BY_ID,
  COMMAND_ITEMS,
  Keys,
  Toast,
  useEditor,
  useEditorShortcuts,
  usePaletteToggle,
  useToast,
} from "./shared";
import { EditorFrame } from "./frame";

const WITH_CLIP = ["split", "delete", "ripple", "add-effect"];
const WITHOUT_CLIP = ["import", "add-text", "export"];
// The harness owns ← → and R, so those three never get a "press X" tip.
const NO_TIP = new Set(["prev-frame", "next-frame", "ripple"]);

export function Contextual() {
  const editor = useEditor({ selectedClipId: "c2", time: 30 });
  const { toast, show } = useToast();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const taught = useRef(new Set<string>());

  usePaletteToggle(open, setOpen);
  const runFromFrame = useCallback((id: string) => show(editor.run(id)), [editor.run, show]);
  useEditorShortcuts(!open, runFromFrame);

  const clip = CLIPS.find((c) => c.id === editor.state.selectedClipId);
  const suggestions = useMemo(() => (clip ? WITH_CLIP : WITHOUT_CLIP), [clip]);
  const why = clip ? `Because “${clip.label}” is selected` : "Nothing selected · start here";

  const onSelect = (item: CommandMenuItemData) => {
    const message = editor.run(item.value);
    const cmd = COMMAND_BY_ID[item.value];
    const firstTime = !taught.current.has(item.value) && !NO_TIP.has(item.value);
    taught.current.add(item.value);
    show(
      message,
      firstTime && cmd ? (
        <span className="flex items-center gap-1.5">
          Next time press <Keys shortcut={cmd.shortcut} />
        </span>
      ) : undefined
    );
    setOpen(false);
  };

  return (
    <EditorFrame editor={editor} onOpenPalette={() => setOpen(true)} selectable>
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="absolute inset-0 z-40 bg-black/40"
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
            className="absolute left-1/2 top-[13%] z-50 w-[560px] max-w-[calc(100%-2rem)]"
            style={{ x: "-50%", transformOrigin: "50% 0%" }}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4, transition: spring.moderate.exit }}
            transition={spring.slow}
          >
            <Elevated offset={4} className="flex max-h-[460px] flex-col overflow-hidden rounded-xl">
              <CommandMenu
                items={COMMAND_ITEMS}
                onSelect={onSelect}
                query={query}
                onQueryChange={setQuery}
                suggestions={suggestions}
                suggestionsLabel={why}
                className="max-h-[460px]"
              >
                <CommandMenuInput autoFocus placeholder="Type to search every command…" />
                {query === "" && (
                  <div className="flex shrink-0 items-center gap-2 px-4 pb-2.5 text-[12px] text-muted-foreground">
                    <MousePointer2 size={12} strokeWidth={1.75} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {clip ? (
                        <>
                          Selection: <span className="text-foreground">{clip.label}</span>
                          <span className="text-muted-foreground/60"> · Video 1</span>
                        </>
                      ) : (
                        "No clip selected. Click a clip in the timeline to get editing commands first."
                      )}
                    </span>
                    {clip ? (
                      <Button variant="ghost" size="compact" className="-mr-2 h-6 px-2 text-[11px]" onClick={() => editor.selectClip(null)}>
                        Deselect
                      </Button>
                    ) : (
                      <Button variant="ghost" size="compact" className="-mr-2 h-6 px-2 text-[11px]" onClick={() => editor.selectClip("c2")}>
                        Select a clip
                      </Button>
                    )}
                  </div>
                )}
                <CommandMenuList className="px-1.5 pb-1.5">
                  <CommandMenuEmpty>No command matches.</CommandMenuEmpty>
                </CommandMenuList>
                <CommandMenuFooter
                  className="border-t border-border/60"
                  hints={[
                    { label: "Move", keys: ["up", "down"] },
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
