"use client";

/**
 * Compact — a slim bar docked under the top bar, left-aligned like a menu
 * that dropped down. Eight 26px rows, 12px type, no headers: the group is
 * a muted prefix ("Edit ›"). Subsequence matching so "spl" or "zti" hit;
 * matched letters are emboldened so the eye learns the shortest query.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { formatShortcut, useIsMac } from "#/components/ui/command-menu.tsx";
import { Elevated } from "#/lib/elevated.tsx";
import { spring } from "#/lib/springs.ts";
import { cn } from "#/lib/utils.ts";
import { COMMANDS } from "#/prototypes/mock";
import {
  Toast,
  useEditor,
  useEditorShortcuts,
  usePaletteToggle,
  useToast,
  type Command,
} from "./shared";
import { EditorFrame } from "./frame";

const ROW = 26;
const VISIBLE = 8;

/** Subsequence match; returns the matched character indexes or null. */
function fuzzy(label: string, query: string): number[] | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (q === "") return [];
  const l = label.toLowerCase();
  const hits: number[] = [];
  let from = 0;
  for (const ch of q) {
    const i = l.indexOf(ch, from);
    if (i === -1) return null;
    hits.push(i);
    from = i + 1;
  }
  return hits;
}

/** Tighter matches (fewer gaps, earlier start) rank first. */
function score(hits: number[]): number {
  if (hits.length === 0) return 0;
  return hits[hits.length - 1] - hits[0] - hits.length + 1 + hits[0] * 0.1;
}

export function Compact() {
  const editor = useEditor();
  const { toast, show } = useToast();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [usage, setUsage] = useState<Record<string, number>>({ split: 6, play: 4, undo: 3 });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const mac = useIsMac();

  usePaletteToggle(open, setOpen);
  const runFromFrame = useCallback((id: string) => show(editor.run(id)), [editor.run, show]);
  useEditorShortcuts(!open, runFromFrame);

  const results = useMemo(() => {
    const rows: { cmd: Command; hits: number[] }[] = [];
    for (const cmd of COMMANDS) {
      const hits = fuzzy(cmd.label, query);
      if (hits) rows.push({ cmd, hits });
    }
    if (query === "") rows.sort((a, b) => (usage[b.cmd.id] ?? 0) - (usage[a.cmd.id] ?? 0));
    else rows.sort((a, b) => score(a.hits) - score(b.hits));
    return rows;
  }, [query, usage]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (cmd: Command) => {
    show(editor.run(cmd.id));
    setUsage((u) => ({ ...u, [cmd.id]: (u[cmd.id] ?? 0) + 1 }));
    setOpen(false);
  };

  return (
    <EditorFrame editor={editor} onOpenPalette={() => setOpen(true)}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="bar"
            className="absolute left-3 top-[46px] z-50 w-[440px] max-w-[calc(100%-1.5rem)]"
            style={{ transformOrigin: "0% 0%" }}
            initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -2, transition: spring.fast.exit }}
            transition={spring.moderate}
          >
            <Elevated offset={4} className="overflow-hidden rounded-lg">
              <div className="flex h-8 items-center gap-2 border-b border-border/60 px-2.5">
                <Search size={13} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((a) => Math.min(results.length - 1, a + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((a) => Math.max(0, a - 1));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const r = results[active];
                      if (r) pick(r.cmd);
                    } else if (e.key === "Escape" && query !== "") {
                      e.preventDefault();
                      setQuery("");
                    }
                  }}
                  placeholder="Command…"
                  spellCheck={false}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-[12px] leading-5 text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="text-[10px] tabular-nums text-muted-foreground/70">
                  {results.length}/{COMMANDS.length}
                </span>
              </div>
              <div
                ref={listRef}
                role="listbox"
                className="overflow-y-auto py-1"
                style={{ maxHeight: ROW * VISIBLE + 8 }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {results.length === 0 && (
                  <div className="px-2.5 py-3 text-[11px] text-muted-foreground">No match</div>
                )}
                {results.map(({ cmd, hits }, i) => {
                  const on = i === active;
                  const caps = formatShortcut(cmd.shortcut, mac);
                  return (
                    <div
                      key={cmd.id}
                      role="option"
                      aria-selected={on}
                      onMouseMove={() => setActive(i)}
                      onClick={() => pick(cmd)}
                      className={cn(
                        "mx-1 flex cursor-pointer items-center gap-1.5 rounded-[5px] px-1.5 text-[12px] leading-none",
                        on ? "bg-active text-foreground" : "text-muted-foreground"
                      )}
                      style={{ height: ROW }}
                    >
                      <span className="w-[64px] shrink-0 truncate text-[10.5px] text-muted-foreground/60">
                        {cmd.group} ›
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {cmd.label.split("").map((ch, k) => (
                          <span key={k} className={hits.includes(k) ? "font-semibold text-foreground" : undefined}>
                            {ch}
                          </span>
                        ))}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[10.5px] tabular-nums",
                          on ? "text-foreground/80" : "text-muted-foreground/60"
                        )}
                      >
                        {caps.join(mac ? "" : "+")}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex h-6 items-center gap-3 border-t border-border/60 px-2.5 text-[10px] text-muted-foreground/70">
                <span>↑↓ move</span>
                <span>↵ run</span>
                <span>esc close</span>
                {query === "" && <span className="ml-auto">sorted by how often you use them</span>}
              </div>
            </Elevated>
          </motion.div>
        )}
      </AnimatePresence>
      <Toast toast={toast} />
    </EditorFrame>
  );
}
