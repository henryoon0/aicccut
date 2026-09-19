"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, ChevronRight, Film, Folder, FolderOpen, Image as ImageIcon, MonitorPlay, Search } from "lucide-react";
import type { IconComponent } from "#/lib/icon-context.tsx";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { ScrollArea } from "#/components/ui/scroll-area";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { ASSETS, shortDuration, type Asset } from "#/prototypes/mock";
import { EditorFrame, KindIcon, Thumb, matchesQuery, metaLine, sortAssets, useFrame } from "./shared";

interface Bin {
  id: string;
  name: string;
  icon: IconComponent;
}

const BINS: Bin[] = [
  { id: "footage", name: "Footage", icon: Film },
  { id: "screen", name: "Screen recordings", icon: MonitorPlay },
  { id: "audio", name: "Audio", icon: AudioLines },
  { id: "graphics", name: "Graphics", icon: ImageIcon },
];

const ROOT = "root";

function initialBin(a: Asset): string {
  if (a.kind === "audio") return "audio";
  if (a.kind === "image") return "graphics";
  if (a.name.startsWith("screen_")) return "screen";
  return "footage";
}

export function Bins() {
  return (
    <EditorFrame panelWidth={440}>
      <BinsPanel />
    </EditorFrame>
  );
}

function BinsPanel() {
  const { beginDrag, addClips, setPreview, dragging } = useFrame();
  const [assign, setAssign] = useState<Record<string, string>>(() => Object.fromEntries(ASSETS.map((a) => [a.id, initialBin(a)])));
  const [current, setCurrent] = useState<string>("footage");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ id: number; text: string } | null>(null);
  const binRefs = useRef(new Map<string, HTMLElement>());
  const listRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const searching = query.trim().length > 0;
  const items = useMemo(() => {
    const base = ASSETS.filter((a) => (searching || current === ROOT ? true : assign[a.id] === current) && matchesQuery(a, query));
    return sortAssets(base, "name", "asc");
  }, [assign, current, query, searching]);

  const countOf = (binId: string) => ASSETS.filter((a) => assign[a.id] === binId).length;

  useEffect(() => {
    if (!moved) return;
    const t = setTimeout(() => setMoved(null), 1600);
    return () => clearTimeout(t);
  }, [moved]);

  const binAt = (x: number, y: number): string | null => {
    for (const [id, el] of binRefs.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  };
  const hoverBin = dragging ? binAt(dragging.x, dragging.y) : null;

  const startDrag = (a: Asset, e: React.PointerEvent) => {
    setSelected(a.id);
    setPreview(a);
    beginDrag(a, e, {
      onDrop: (pt, assets) => {
        const target = binAt(pt.x, pt.y);
        if (!target || target === ROOT) return false;
        const changed = assets.filter((x) => assign[x.id] !== target);
        if (changed.length === 0) return true;
        setAssign((prev) => {
          const next = { ...prev };
          for (const x of changed) next[x.id] = target;
          return next;
        });
        seq.current += 1;
        setMoved({ id: seq.current, text: `Moved ${changed[0].name} to ${BINS.find((b) => b.id === target)?.name}` });
        return true;
      },
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    const idx = Math.max(0, items.findIndex((a) => a.id === selected));
    let next = idx;
    if (e.key === "ArrowDown") next = Math.min(items.length - 1, idx + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, idx - 1);
    else if (e.key === "Enter" && items[idx]) { e.preventDefault(); addClips([items[idx]]); return; }
    else if (e.key === "Backspace" && current !== ROOT) { setCurrent(ROOT); return; }
    else return;
    e.preventDefault();
    setSelected(items[next].id);
    setPreview(items[next]);
    listRef.current?.querySelector<HTMLElement>(`[data-id="${items[next].id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const currentBin = BINS.find((b) => b.id === current);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="text-sm font-medium">Project</span>
        <div className="ml-auto w-48">
          <InputGroup size="compact">
            <InputField index={0} label="Search all bins" labelHidden icon={Search} placeholder="Search all bins" value={query} onChange={setQuery} />
          </InputGroup>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Tree */}
        <nav aria-label="Bins" className="flex w-[152px] shrink-0 flex-col border-r border-border py-2">
          <BinRow
            id={ROOT}
            label="All media"
            icon={current === ROOT ? FolderOpen : Folder}
            count={ASSETS.length}
            active={current === ROOT && !searching}
            hover={false}
            register={(el) => register(binRefs, ROOT, el)}
            onClick={() => { setCurrent(ROOT); setQuery(""); }}
          />
          <div className="ml-3 mt-1 flex flex-col border-l border-border pl-1">
            {BINS.map((b) => (
              <BinRow
                key={b.id}
                id={b.id}
                label={b.name}
                icon={b.icon}
                count={countOf(b.id)}
                active={current === b.id && !searching}
                hover={hoverBin === b.id}
                register={(el) => register(binRefs, b.id, el)}
                onClick={() => { setCurrent(b.id); setQuery(""); }}
              />
            ))}
          </div>
          <div className="mt-auto px-3 pb-1 text-[10px] leading-snug text-muted-foreground">Drag a clip onto a bin to move it.</div>
        </nav>

        {/* Contents */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-3 text-[11px]">
            {searching ? (
              <span className="text-muted-foreground">Results for “{query}” across all bins</span>
            ) : (
              <>
                <button type="button" onClick={() => setCurrent(ROOT)} className={cn("rounded-sm px-1 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring", current === ROOT ? "text-foreground" : "text-muted-foreground")}>Project</button>
                {currentBin && (
                  <>
                    <ChevronRight size={11} strokeWidth={1.5} className="text-muted-foreground" />
                    <span className="rounded-sm px-1 text-foreground">{currentBin.name}</span>
                  </>
                )}
                <span className="ml-auto tabular-nums text-muted-foreground">{items.length} items</span>
              </>
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:block! [&>div]:w-full">
            <div ref={listRef} role="listbox" aria-label="Bin contents" tabIndex={0} onKeyDown={onKeyDown} onFocus={() => { if (!selected && items[0]) { setSelected(items[0].id); setPreview(items[0]); } }} className="flex flex-col p-1.5 outline-none">
              {items.map((a) => (
                <div
                  key={a.id}
                  role="option"
                  aria-selected={selected === a.id}
                  data-id={a.id}
                  onPointerDown={(e) => startDrag(a, e)}
                  onDoubleClick={() => addClips([a])}
                  className={cn(
                    "flex cursor-grab touch-none select-none items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors duration-80 active:cursor-grabbing",
                    selected === a.id ? "bg-selected/50" : "hover:bg-hover",
                  )}
                >
                  <Thumb asset={a} className="h-9 w-14 shrink-0 rounded-[4px]" bars={14}>
                    <span className="absolute bottom-0.5 left-0.5 grid size-4 place-items-center rounded-[3px] bg-black/45 text-white"><KindIcon kind={a.kind} size={10} /></span>
                  </Thumb>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs">{a.name}</span>
                      {(searching || current === ROOT) && (
                        <span className="shrink-0 rounded-[4px] bg-surface-4 px-1 py-px text-[10px] text-muted-foreground">{BINS.find((b) => b.id === assign[a.id])?.name}</span>
                      )}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{metaLine(a)}</div>
                  </div>
                  {a.kind !== "image" && <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{shortDuration(a.duration)}</span>}
                </div>
              ))}
              {items.length === 0 && (
                <div className="py-14 text-center text-xs text-muted-foreground">{searching ? "No matches in any bin." : "This bin is empty. Drag clips here from another bin."}</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <AnimatePresence>
        {moved && (
          <motion.div key={moved.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.moderate} className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-surface-6 px-2.5 py-1 text-[11px] shadow-surface-4">
            {moved.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function register(map: React.RefObject<Map<string, HTMLElement>>, id: string, el: HTMLElement | null) {
  if (el) map.current.set(id, el);
  else map.current.delete(id);
}

interface BinRowProps {
  id: string;
  label: string;
  icon: IconComponent;
  count: number;
  active: boolean;
  hover: boolean;
  register: (el: HTMLElement | null) => void;
  onClick: () => void;
}

function BinRow({ label, icon: Icon, count, active, hover, register, onClick }: BinRowProps) {
  return (
    <button
      type="button"
      ref={register}
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "mx-1.5 flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs outline-none transition-[background-color,box-shadow] duration-80 focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-selected/50 text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground",
        hover && "ring-2 ring-foreground bg-selected/40 text-foreground",
      )}
    >
      <Icon size={13} strokeWidth={1.5} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <span className="text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}
