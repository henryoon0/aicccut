"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Search } from "lucide-react";
import { Button } from "#/components/ui/button";
import { DropdownContent, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { ScrollArea } from "#/components/ui/scroll-area";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import { ASSETS, shortDuration, type Asset, type AssetKind } from "#/prototypes/mock";
import { EditorFrame, KindIcon, SORT_LABEL, Thumb, matchesQuery, resolution, shortRes, sortAssets, useFrame, type SortDir, type SortKey } from "./shared";

const COLS = 2;
const SORT_KEYS: SortKey[] = ["added", "name", "kind", "duration", "size"];
type Filter = "all" | AssetKind;

export function Grid() {
  return (
    <EditorFrame panelWidth={380}>
      <GridPanel />
    </EditorFrame>
  );
}

function GridPanel() {
  const { beginDrag, addClips, setPreview } = useFrame();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const base = ASSETS.filter((a) => (filter === "all" || a.kind === filter) && matchesQuery(a, query));
    return sortAssets(base, sortKey, sortDir);
  }, [filter, query, sortKey, sortDir]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, video: 0, audio: 0, image: 0 };
    for (const a of ASSETS) {
      if (!matchesQuery(a, query)) continue;
      c.all += 1;
      c[a.kind] += 1;
    }
    return c;
  }, [query]);

  // Keep selection valid as filters change.
  useEffect(() => {
    if (selected && !items.some((a) => a.id === selected)) setSelected(items[0]?.id ?? null);
  }, [items, selected]);

  const select = useCallback(
    (a: Asset | null) => {
      setSelected(a?.id ?? null);
      setPreview(a);
    },
    [setPreview],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    const idx = Math.max(0, items.findIndex((a) => a.id === selected));
    let next = idx;
    switch (e.key) {
      case "ArrowRight": next = Math.min(items.length - 1, idx + 1); break;
      case "ArrowLeft": next = Math.max(0, idx - 1); break;
      case "ArrowDown": next = Math.min(items.length - 1, idx + COLS); break;
      case "ArrowUp": next = Math.max(0, idx - COLS); break;
      case "Home": next = 0; break;
      case "End": next = items.length - 1; break;
      case "Enter": {
        const a = items[idx];
        if (a) addClips([a]);
        e.preventDefault();
        return;
      }
      case "Escape": select(null); return;
      default: return;
    }
    e.preventDefault();
    select(items[next]);
    gridRef.current?.querySelector<HTMLElement>(`[data-id="${items[next].id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="text-sm font-medium">Media</span>
        <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip content={sortDir === "asc" ? "Ascending" : "Descending"} side="bottom">
            <Button variant="ghost" size="icon-compact" aria-label="Toggle sort direction" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortDir === "asc" ? <ArrowUpAZ size={14} strokeWidth={1.5} /> : <ArrowDownAZ size={14} strokeWidth={1.5} />}
            </Button>
          </Tooltip>
          <DropdownMenu size="compact">
            <DropdownTrigger render={<Button variant="ghost" size="compact" trailingIcon={ChevronDown}>{SORT_LABEL[sortKey]}</Button>} />
            <DropdownContent align="end" checkedIndex={SORT_KEYS.indexOf(sortKey)}>
              <DropdownLabel>Sort by</DropdownLabel>
              {SORT_KEYS.map((k, i) => (
                <MenuItem key={k} index={i} label={SORT_LABEL[k]} checked={sortKey === k} onSelect={() => setSortKey(k)} />
              ))}
              <DropdownSeparator />
              <MenuItem index={SORT_KEYS.length} label={sortDir === "asc" ? "Ascending" : "Descending"} onSelect={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} />
            </DropdownContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2">
        <InputGroup size="compact">
          <InputField index={0} label="Search media" labelHidden icon={Search} placeholder="Search name, 4K, 60fps…" value={query} onChange={setQuery} />
        </InputGroup>
        <Tabs size="compact" value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList aria-label="Filter by kind">
            <TabItem value="all" label={`All ${counts.all}`} />
            <TabItem value="video" label={`Video ${counts.video}`} />
            <TabItem value="audio" label={`Audio ${counts.audio}`} />
            <TabItem value="image" label={`Image ${counts.image}`} />
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div
          ref={gridRef}
          role="listbox"
          aria-label="Media grid"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => { if (!selected && items[0]) select(items[0]); }}
          className="grid grid-cols-2 gap-2 px-3 pb-3 outline-none focus-visible:[&_[aria-selected=true]]:ring-2 focus-visible:[&_[aria-selected=true]]:ring-ring"
        >
          {items.map((a) => (
            <Tile key={a.id} asset={a} selected={selected === a.id} onSelect={() => select(a)} onOpen={() => addClips([a])} onDragStart={(e) => beginDrag(a, e)} />
          ))}
          {items.length === 0 && (
            <div className="col-span-2 py-16 text-center text-xs text-muted-foreground">No media matches “{query}”.</div>
          )}
        </div>
      </ScrollArea>

      <footer className="flex h-8 shrink-0 items-center gap-2 border-t border-border px-3 text-[11px] text-muted-foreground">
        <span>Drag to timeline · Enter adds at playhead</span>
      </footer>
    </div>
  );
}

interface TileProps {
  asset: Asset;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

function Tile({ asset, selected, onSelect, onOpen, onDragStart }: TileProps) {
  const res = shortRes(asset);
  return (
    <div
      role="option"
      aria-selected={selected}
      data-id={asset.id}
      onPointerDown={(e) => { onSelect(); onDragStart(e); }}
      onDoubleClick={onOpen}
      className={cn(
        "group relative cursor-grab touch-none select-none overflow-hidden rounded-lg ring-offset-1 ring-offset-surface-2 transition-[box-shadow,transform] duration-80 active:cursor-grabbing",
        selected ? "ring-2 ring-foreground" : "hover:ring-1 hover:ring-border",
      )}
    >
      <Thumb asset={asset} className="aspect-[4/3] w-full">
        <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-[4px] bg-black/45 text-white">
          <KindIcon kind={asset.kind} size={11} />
        </span>
        {asset.kind !== "image" && (
          <span className="absolute bottom-1.5 right-1.5 rounded-[4px] bg-black/55 px-1 py-px text-[10px] tabular-nums text-white">{shortDuration(asset.duration)}</span>
        )}
        {res && <span className="absolute right-1.5 top-1.5 rounded-[4px] bg-black/45 px-1 py-px text-[10px] font-medium text-white">{res}</span>}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/85 to-black/0 px-2 pb-1.5 pt-5 text-white opacity-0 transition-[transform,opacity] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none">
          <div className="truncate text-[11px] font-medium">{asset.name}</div>
          <div className="text-[10px] text-white/70">{asset.width ? resolution(asset) : "Audio"}{asset.fps ? ` · ${asset.fps}fps` : ""}</div>
        </div>
      </Thumb>
    </div>
  );
}
