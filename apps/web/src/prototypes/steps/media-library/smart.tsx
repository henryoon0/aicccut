"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Search, X } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Kbd } from "#/components/ui/kbd";
import { ScrollArea } from "#/components/ui/scroll-area";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { ASSETS, relativeTime, shortDuration, type Asset } from "#/prototypes/mock";
import { ALL_TAGS, EditorFrame, KIND_LABEL, KIND_ORDER, KindIcon, Thumb, matchesQuery, metaLine, sortAssets, tagsOf, useFrame } from "./shared";

const TODAY = "2026-09-19";

export function Smart() {
  return (
    <EditorFrame panelWidth={400}>
      <SmartPanel />
    </EditorFrame>
  );
}

function SmartPanel() {
  const { beginDrag, addClips, setPreview } = useFrame();
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const active = query.trim().length > 0 || tags.size > 0;

  const results = useMemo(() => {
    const base = ASSETS.filter((a) => matchesQuery(a, query) && [...tags].every((t) => tagsOf(a).includes(t)));
    return sortAssets(base, "added", "desc");
  }, [query, tags]);

  // Tag counts are computed against the *other* constraints so a chip shows
  // how many results it would leave.
  const tagCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const t of ALL_TAGS) {
      const n = ASSETS.filter((a) => matchesQuery(a, query) && [...tags].filter((x) => x !== t).every((x) => tagsOf(a).includes(x)) && tagsOf(a).includes(t)).length;
      c.set(t, n);
    }
    return c;
  }, [query, tags]);

  const groups = useMemo(
    () => KIND_ORDER.map((k) => ({ kind: k, items: results.filter((a) => a.kind === k) })).filter((g) => g.items.length > 0),
    [results],
  );
  const recent = useMemo(() => sortAssets(ASSETS.filter((a) => a.addedAt.startsWith(TODAY)), "added", "desc"), []);

  const flat = active ? results : recent;

  useEffect(() => {
    if (focusId && !flat.some((a) => a.id === focusId)) setFocusId(null);
  }, [flat, focusId]);

  const toggleTag = (t: string) =>
    setTags((prev) => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  const focus = (a: Asset) => {
    setFocusId(a.id);
    setPreview(a);
    listRef.current?.querySelector<HTMLElement>(`[data-id="${a.id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (flat.length === 0) return;
    const idx = flat.findIndex((a) => a.id === focusId);
    if (e.key === "ArrowDown") { e.preventDefault(); focus(flat[Math.min(flat.length - 1, idx + 1)]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focus(flat[Math.max(0, idx - 1)]); }
    else if (e.key === "Enter" && idx >= 0) { e.preventDefault(); addClips([flat[idx]]); }
    else if (e.key === "Escape") {
      if (query || tags.size) { setQuery(""); setTags(new Set()); }
      else setFocusId(null);
    }
  };

  return (
    <div className="flex h-full flex-col" onKeyDown={onKeyDown}>
      {/* Search hero */}
      <div className="shrink-0 px-3 pt-3">
        <label className="group flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-3 px-3 transition-[box-shadow,border-color] duration-80 focus-within:border-foreground/40 focus-within:shadow-surface-3">
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search media, or try “screen 60fps”"
            aria-label="Search media"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {active ? (
            <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setTags(new Set()); inputRef.current?.focus(); }} className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground">
              <X size={12} strokeWidth={2} />
            </button>
          ) : (
            <Kbd className="text-[10px]">⌘F</Kbd>
          )}
        </label>

        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
          {ALL_TAGS.map((t) => {
            const on = tags.has(t);
            const n = tagCounts.get(t) ?? 0;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                disabled={!on && n === 0}
                onClick={() => toggleTag(t)}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] outline-none transition-[background-color,border-color,color] duration-80 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35",
                  on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-hover hover:text-foreground",
                )}
              >
                {t}
                <span className={cn("tabular-nums", on ? "text-background/70" : "text-muted-foreground/70")}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="mt-3 min-h-0 flex-1 border-t border-border" viewportClassName="[&>div]:block! [&>div]:w-full">
        <div ref={listRef} className="px-3 pb-3">
          <AnimatePresence mode="wait" initial={false}>
            {active ? (
              <motion.div key="results" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.moderate}>
                <div className="flex h-8 items-center text-[11px] text-muted-foreground">
                  {results.length} result{results.length === 1 ? "" : "s"}
                  {tags.size > 0 && <span className="ml-1">· {[...tags].join(" + ")}</span>}
                </div>
                {groups.map((g) => (
                  <section key={g.kind} className="mb-3">
                    <h3 className="mb-1 flex items-center gap-1.5 font-sans text-[11px] font-medium">
                      <KindIcon kind={g.kind} size={12} className="text-muted-foreground" />
                      {KIND_LABEL[g.kind]}
                      <Badge size="compact" color="gray" variant="solid">{g.items.length}</Badge>
                    </h3>
                    <div className="flex flex-col">
                      {g.items.map((a) => (
                        <ResultRow key={a.id} asset={a} focused={focusId === a.id} query={query} onPointerDown={(e) => { focus(a); beginDrag(a, e); }} onDoubleClick={() => addClips([a])} />
                      ))}
                    </div>
                  </section>
                ))}
                {results.length === 0 && <div className="py-14 text-center text-xs text-muted-foreground">Nothing matches. Try fewer tags.</div>}
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.moderate}>
                <h3 className="flex h-8 items-center gap-1.5 font-sans text-[11px] font-medium">
                  <Clock size={12} strokeWidth={1.75} className="text-muted-foreground" />
                  Recently added
                  <Badge size="compact" color="gray" variant="solid">{recent.length}</Badge>
                  <span className="ml-auto font-normal text-muted-foreground">today</span>
                </h3>
                <div className="flex flex-col">
                  {recent.map((a) => (
                    <ResultRow key={a.id} asset={a} focused={focusId === a.id} query="" onPointerDown={(e) => { focus(a); beginDrag(a, e); }} onDoubleClick={() => addClips([a])} />
                  ))}
                </div>
                <h3 className="mt-3 flex h-8 items-center font-sans text-[11px] font-medium">Everything by kind</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {KIND_ORDER.map((k) => {
                    const n = ASSETS.filter((a) => a.kind === k).length;
                    return (
                      <button key={k} type="button" onClick={() => setQuery(k)} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-left text-[11px] outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring">
                        <KindIcon kind={k} size={12} className="text-muted-foreground" />
                        <span className="flex-1">{KIND_LABEL[k]}</span>
                        <span className="tabular-nums text-muted-foreground">{n}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <footer className="flex h-8 shrink-0 items-center gap-1 border-t border-border px-3 text-[11px] text-muted-foreground">
        <Kbd>↑↓</Kbd> move · <Kbd>↵</Kbd> add · drag to timeline
      </footer>
    </div>
  );
}

interface ResultRowProps {
  asset: Asset;
  focused: boolean;
  query: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
}

function ResultRow({ asset, focused, query, onPointerDown, onDoubleClick }: ResultRowProps) {
  return (
    <div
      role="option"
      aria-selected={focused}
      data-id={asset.id}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={cn("flex cursor-grab touch-none select-none items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors duration-80 active:cursor-grabbing", focused ? "bg-selected/50" : "hover:bg-hover")}
    >
      <Thumb asset={asset} className="h-8 w-12 shrink-0 rounded-[4px]" bars={12} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs"><Highlight text={asset.name} query={query} /></div>
        <div className="truncate text-[10px] text-muted-foreground">{metaLine(asset)}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-[10px] tabular-nums text-muted-foreground">
        <span>{asset.kind === "image" ? KIND_LABEL.image : shortDuration(asset.duration)}</span>
        <span>{relativeTime(asset.addedAt)}</span>
      </div>
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[2px] bg-foreground/20 text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

