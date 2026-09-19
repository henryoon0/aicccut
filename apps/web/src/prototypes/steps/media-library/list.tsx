"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { Kbd } from "#/components/ui/kbd";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { ASSETS, fileSize, relativeTime, shortDuration, type Asset, type AssetKind } from "#/prototypes/mock";
import { EditorFrame, KIND_LABEL, KindIcon, SORT_LABEL, Thumb, matchesQuery, resolution, sortAssets, useFrame, type SortDir, type SortKey } from "./shared";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "name", label: "Name", className: "w-[38%]" },
  { key: "kind", label: "Kind", className: "w-[14%]" },
  { key: "duration", label: "Dur", className: "w-[14%] text-right" },
  { key: "size", label: "Size", className: "w-[15%] text-right" },
  { key: "added", label: "Added", className: "w-[19%] text-right" },
];

type Filter = "all" | AssetKind;

export function List() {
  return (
    <EditorFrame panelWidth={470}>
      <ListPanel />
    </EditorFrame>
  );
}

function ListPanel() {
  const { beginDrag, addClips, setPreview } = useFrame();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => sortAssets(ASSETS.filter((a) => (filter === "all" || a.kind === filter) && matchesQuery(a, query)), sortKey, sortDir),
    [filter, query, sortKey, sortDir],
  );

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => items.some((a) => a.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "added" || key === "size" || key === "duration" ? "desc" : "asc");
    }
  };

  const selectRow = useCallback(
    (a: Asset, mode: "single" | "toggle" | "range") => {
      setPreview(a);
      setFocusId(a.id);
      if (mode === "single") {
        setSelected(new Set([a.id]));
        setAnchor(a.id);
      } else if (mode === "toggle") {
        setSelected((prev) => {
          const n = new Set(prev);
          if (n.has(a.id)) n.delete(a.id);
          else n.add(a.id);
          return n;
        });
        setAnchor(a.id);
      } else {
        const from = items.findIndex((x) => x.id === (anchor ?? a.id));
        const to = items.findIndex((x) => x.id === a.id);
        const [lo, hi] = from < to ? [from, to] : [to, from];
        setSelected(new Set(items.slice(lo, hi + 1).map((x) => x.id)));
      }
    },
    [anchor, items, setPreview],
  );

  const selectedAssets = useMemo(() => items.filter((a) => selected.has(a.id)), [items, selected]);

  const onRowPointerDown = (a: Asset, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (e.shiftKey) selectRow(a, "range");
    else if (e.metaKey || e.ctrlKey) selectRow(a, "toggle");
    else if (!selected.has(a.id)) selectRow(a, "single");
    else {
      setFocusId(a.id);
      setPreview(a);
    }
    // Drag everything selected when grabbing a selected row; otherwise just this row.
    const payload = selected.has(a.id) && selected.size > 1 && !e.shiftKey && !e.metaKey && !e.ctrlKey ? items.filter((x) => selected.has(x.id)) : [a];
    beginDrag(payload, e);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    const idx = Math.max(0, items.findIndex((a) => a.id === focusId));
    let next = idx;
    switch (e.key) {
      case "ArrowDown": next = Math.min(items.length - 1, idx + 1); break;
      case "ArrowUp": next = Math.max(0, idx - 1); break;
      case "Home": next = 0; break;
      case "End": next = items.length - 1; break;
      case "a":
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          setSelected(new Set(items.map((a) => a.id)));
        }
        return;
      case "Enter":
        e.preventDefault();
        addClips(selectedAssets.length ? selectedAssets : items[idx] ? [items[idx]] : []);
        return;
      case "Escape":
        setSelected(new Set());
        return;
      default:
        return;
    }
    e.preventDefault();
    selectRow(items[next], e.shiftKey ? "range" : "single");
    bodyRef.current?.querySelector<HTMLElement>(`[data-id="${items[next].id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "video", label: "Video" },
    { value: "audio", label: "Audio" },
    { value: "image", label: "Image" },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="text-sm font-medium">Media</span>
        <span className="text-xs tabular-nums text-muted-foreground">{items.length} items</span>
        <div className="ml-auto flex items-center gap-px rounded-md bg-surface-3 p-px text-[11px]">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-[5px] px-2 py-0.5 transition-colors duration-80 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === f.value ? "bg-surface-6 text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="shrink-0 px-3 py-2">
        <InputGroup size="compact">
          <InputField index={0} label="Filter media" labelHidden icon={Search} placeholder="Filter by name or tag" value={query} onChange={setQuery} />
        </InputGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div ref={bodyRef} role="grid" aria-multiselectable tabIndex={0} onKeyDown={onKeyDown} onFocus={() => { if (!focusId && items[0]) selectRow(items[0], "single"); }} className="outline-none">
          <Table size="compact" className="w-full table-fixed text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <TableHeader className="sticky top-0 z-10 bg-surface-2">
              <TableRow>
                {COLUMNS.map((c) => {
                  const active = sortKey === c.key;
                  return (
                    <TableHead key={c.key} className={cn("text-[11px] font-medium text-muted-foreground", c.className)} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-0.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", active && "text-foreground", c.className?.includes("text-right") && "flex-row-reverse")}>
                        {c.label}
                        {active && (sortDir === "asc" ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />)}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a, i) => {
                const isSel = selected.has(a.id);
                return (
                  <TableRow
                    key={a.id}
                    index={i}
                    data-id={a.id}
                    aria-selected={isSel}
                    onPointerDown={(e) => onRowPointerDown(a, e)}
                    onDoubleClick={() => addClips([a])}
                    className={cn("group/row cursor-grab touch-none select-none active:cursor-grabbing", isSel && "bg-selected/45 [&_td]:text-foreground", focusId === a.id && "shadow-[inset_2px_0_0_var(--foreground)]")}
                  >
                    <TableCell className="text-foreground">
                      <div className="flex min-w-0 items-center gap-2">
                        <Thumb asset={a} className="h-5 w-8 shrink-0 rounded-[3px]" bars={10} />
                        <span className="truncate">{a.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1"><KindIcon kind={a.kind} size={11} />{KIND_LABEL[a.kind]}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.kind === "image" ? "—" : shortDuration(a.duration)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fileSize(a.size)}</TableCell>
                    <TableCell className="text-right tabular-nums">{relativeTime(a.addedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {items.length === 0 && <div className="py-16 text-center text-xs text-muted-foreground">Nothing matches. Clear the filter to see all {ASSETS.length} items.</div>}
        </div>
      </ScrollArea>

      {/* Selection footer */}
      <footer className="flex h-9 shrink-0 items-center gap-2 border-t border-border px-3 text-[11px] text-muted-foreground">
        {selectedAssets.length > 0 ? (
          <>
            <span className="text-foreground">{selectedAssets.length} selected</span>
            <span className="tabular-nums">{fileSize(selectedAssets.reduce((s, a) => s + a.size, 0))}</span>
            {selectedAssets.length === 1 && selectedAssets[0].width && <span>{resolution(selectedAssets[0])}</span>}
            <div className="ml-auto flex items-center gap-1">
              <Button variant="secondary" size="compact" onClick={() => addClips(selectedAssets)}>Add to timeline</Button>
              <Button variant="ghost" size="icon-compact" aria-label="Clear selection" onClick={() => setSelected(new Set())}><X size={12} strokeWidth={1.5} /></Button>
            </div>
          </>
        ) : (
          <>
            <span>Sorted by {SORT_LABEL[sortKey].toLowerCase()}</span>
            <span className="ml-auto inline-flex items-center gap-1"><Kbd>⇧</Kbd> range · <Kbd>⌘</Kbd> toggle · <Kbd>↵</Kbd> add</span>
          </>
        )}
      </footer>
    </div>
  );
}
