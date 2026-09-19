/**
 * MediaPanel — the project's asset library. A 2-column grid of thumbnails
 * over the real document assets, with search, kind tabs, sorting, arrow-key
 * navigation, per-tile actions and real file import (drop, browse, paste).
 *
 * The panel is also the import surface: an empty library renders the dropzone
 * instead of the grid, and files dragged anywhere over the window raise the
 * catch overlay. Dropped files are probed, added to the document and kept in
 * the in-memory registry of `files.ts` so tiles can show decoded media.
 *
 * `filter="audio"` narrows it to audio assets for the shell's Audio rail.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Search } from "lucide-react";
import { Button } from "#/components/ui/button";
import { DropdownContent, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "#/components/ui/dropdown";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { MenuItem } from "#/components/ui/menu-item";
import { ScrollArea } from "#/components/ui/scroll-area";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import { useActions, useEditor, useEditorContext, useEditorStore, type Asset, type AssetKind } from "#/editor/core";
import { DragGhost, useAssetDrag } from "./drag";
import { Dropzone, DoneToast, PendingTile, WindowDropOverlay } from "./dropzone";
import { releaseAssetFile } from "./files";
import { SORT_KEYS, SORT_LABEL, SORT_SHORT, matchesQuery, sortAssets, type SortDir, type SortKey } from "./helpers";
import { useDropTarget, useFilePicker, useImportFiles, usePasteImport, useWindowDrag } from "./import";
import { Tile } from "./tile";

// The timeline receives drops through this event; re-exported so the other
// area imports the protocol from `#/editor/media` rather than a deep path.
export { ASSET_DRAG_EVENT } from "./drag";
export type { AssetDragDetail, AssetDragEvent, AssetDragPhase } from "./drag";
export { getAssetFile, getAssetUrl, registerAssetFile, releaseAssetFile, useAssetUrl } from "./files";

const COLS = 2;
type Filter = "all" | AssetKind;

export interface MediaPanelProps {
  /** Narrow the library to one kind; the shell's Audio rail passes "audio". */
  filter?: "audio";
}

export function MediaPanel({ filter: lock }: MediaPanelProps = {}) {
  const assets = useEditor((s) => s.doc.assets);
  const actions = useActions();
  const store = useEditorStore();
  const { time } = useEditorContext();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { pending, importFiles, done, clearDone } = useImportFiles();
  const picker = useFilePicker(importFiles);
  const drop = useDropTarget(importFiles);
  const windowDragging = useWindowDrag(importFiles);
  usePasteImport(importFiles);
  const { begin, dragging } = useAssetDrag();

  // The library this panel is allowed to show, before search and tabs.
  const scope = useMemo(() => (lock ? assets.filter((a) => a.kind === lock) : assets), [assets, lock]);
  const kind: Filter = lock ?? filter;

  const items = useMemo(() => {
    const base = scope.filter((a) => (kind === "all" || a.kind === kind) && matchesQuery(a, query));
    return sortAssets(base, sortKey, sortDir);
  }, [scope, kind, query, sortKey, sortDir]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, video: 0, audio: 0, image: 0 };
    for (const a of scope) {
      if (!matchesQuery(a, query)) continue;
      c.all += 1;
      c[a.kind] += 1;
    }
    return c;
  }, [scope, query]);

  // Keep the roving selection on something that still exists.
  useEffect(() => {
    if (selected && !items.some((a) => a.id === selected)) setSelected(items[0]?.id ?? null);
  }, [items, selected]);

  const addAtPlayhead = useCallback(
    (assetId: string) => actions.addClipFromAsset(assetId, "auto", time.get()),
    [actions, time],
  );

  const remove = useCallback(
    (assetId: string) => {
      actions.removeAsset(assetId);
      releaseAssetFile(assetId);
    },
    [actions],
  );

  /**
   * Rename through the store so it lands in history like any other edit.
   * Clips still carrying the name they were created with follow along;
   * anything the user relabelled on the timeline is left alone.
   */
  const rename = useCallback(
    (assetId: string, name: string) => {
      setRenamingId(null);
      store.mutateDoc((d) => {
        const asset = d.assets.find((a) => a.id === assetId);
        if (!asset || asset.name === name) return d;
        const stem = (s: string) => s.replace(/\.[^.]+$/, "");
        return {
          ...d,
          assets: d.assets.map((a) => (a.id === assetId ? { ...a, name } : a)),
          clips: d.clips.map((c) => (c.assetId === assetId && c.label === stem(asset.name) ? { ...c, label: stem(name) } : c)),
        };
      });
    },
    [store],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0 || renamingId) return;
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
        if (a) addAtPlayhead(a.id);
        e.preventDefault();
        return;
      }
      case "Escape": setSelected(null); return;
      default: return;
    }
    e.preventDefault();
    setSelected(items[next].id);
    gridRef.current?.querySelector<HTMLElement>(`[data-id="${items[next].id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const label = lock === "audio" ? "Audio" : "Media";
  const showDropzone = scope.length === 0 && pending.length === 0;

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col bg-surface-2 text-foreground">
      {!showDropzone && (
        <div className="flex shrink-0 items-center gap-1 px-3 pt-2.5">
          <span data-testid="media-count" className="text-[11px] tabular-nums text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Tooltip content={sortDir === "asc" ? "Ascending" : "Descending"} side="bottom">
              <Button
                variant="ghost"
                size="icon-compact"
                aria-label="Toggle sort direction"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              >
                {sortDir === "asc" ? <ArrowUpAZ size={14} strokeWidth={1.5} /> : <ArrowDownAZ size={14} strokeWidth={1.5} />}
              </Button>
            </Tooltip>
            <DropdownMenu size="compact">
              <DropdownTrigger
                render={
                  <Button variant="ghost" size="compact" trailingIcon={ChevronDown} className="whitespace-nowrap" aria-label={`Sort by ${SORT_LABEL[sortKey]}`}>
                    {SORT_SHORT[sortKey]}
                  </Button>
                }
              />
              <DropdownContent align="end" checkedIndex={SORT_KEYS.indexOf(sortKey)}>
                <DropdownLabel>Sort by</DropdownLabel>
                {SORT_KEYS.map((k, i) => (
                  <MenuItem key={k} index={i} label={SORT_LABEL[k]} checked={sortKey === k} onSelect={() => setSortKey(k)} />
                ))}
                <DropdownSeparator />
                <MenuItem
                  index={SORT_KEYS.length}
                  label={sortDir === "asc" ? "Ascending" : "Descending"}
                  onSelect={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                />
              </DropdownContent>
            </DropdownMenu>
            <Button variant="ghost" size="compact" className="whitespace-nowrap" onClick={picker.open}>Import</Button>
          </div>
        </div>
      )}
      {picker.input}

      {showDropzone ? (
        <Dropzone over={drop.over} onBrowse={picker.open} bind={drop.bind} />
      ) : (
        <>
          <div className="flex shrink-0 flex-col gap-2 px-3 pb-2 pt-2">
            <InputGroup size="compact" className="w-full">
              <InputField
                index={0}
                label={`Search ${label.toLowerCase()}`}
                labelHidden
                icon={Search}
                placeholder="Search name, 4K, 60fps…"
                value={query}
                onChange={setQuery}
              />
            </InputGroup>
            {!lock && (
              <Tabs size="compact" value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList aria-label="Filter by kind">
                  <TabItem value="all" label={`All ${counts.all}`} />
                  <TabItem value="video" label={`Video ${counts.video}`} />
                  <TabItem value="audio" label={`Audio ${counts.audio}`} />
                  <TabItem value="image" label={`Image ${counts.image}`} />
                </TabsList>
              </Tabs>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col" {...drop.bind}>
            <ScrollArea className="min-h-0 flex-1">
              <div
                ref={gridRef}
                role="listbox"
                aria-label={`${label} library`}
                tabIndex={0}
                onKeyDown={onKeyDown}
                onFocus={() => { if (!selected && items[0]) setSelected(items[0].id); }}
                className={cn(
                  "grid grid-cols-2 gap-2 rounded-lg px-3 pb-3 outline-none transition-colors",
                  "focus-visible:[&_[aria-selected=true]]:ring-2 focus-visible:[&_[aria-selected=true]]:ring-ring",
                  drop.over && "bg-selected",
                )}
              >
                {pending.map((p) => <PendingTile key={p.id} item={p} />)}
                {items.map((a: Asset) => (
                  <Tile
                    key={a.id}
                    asset={a}
                    selected={selected === a.id}
                    renaming={renamingId === a.id}
                    onSelect={() => setSelected(a.id)}
                    onOpen={() => addAtPlayhead(a.id)}
                    onDragStart={(e) => begin(a, e)}
                    onStartRename={() => setRenamingId(a.id)}
                    onCommitRename={(name) => rename(a.id, name)}
                    onCancelRename={() => setRenamingId(null)}
                    onRemove={() => remove(a.id)}
                  />
                ))}
                {items.length === 0 && pending.length === 0 && (
                  <p className="col-span-2 py-16 text-center text-xs text-muted-foreground">
                    {query ? `No media matches “${query}”.` : "Nothing here yet. Drop files or press Import."}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </>
      )}

      {!showDropzone && (
        <footer className="flex h-8 shrink-0 items-center gap-2 border-t border-border px-3 text-[11px] text-muted-foreground">
          <span>Drag to timeline · Enter adds at playhead</span>
        </footer>
      )}

      <DoneToast count={done?.count ?? null} onDismiss={clearDone} />
      <DragGhost state={dragging} />
      <WindowDropOverlay show={windowDragging} />
    </div>
  );
}
