"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, Play } from "lucide-react";
import { Button } from "#/components/ui/button";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { ScrollArea, ScrollBar } from "#/components/ui/scroll-area";
import { TabsSubtle, TabsSubtleItem } from "#/components/ui/tabs-subtle";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { ASSETS, fileSize, relativeTime, shortDuration, timecode, type Asset, type AssetKind } from "#/prototypes/mock";
import { EditorFrame, KIND_LABEL, KindIcon, Thumb, matchesQuery, resolution, sortAssets, tagsOf, useFrame, waveform } from "./shared";

const FILTERS: ("all" | AssetKind)[] = ["all", "video", "audio", "image"];

interface Scrub {
  id: string;
  frac: number;
}

export function Filmstrip() {
  return (
    <EditorFrame panelWidth={420}>
      <FilmstripPanel />
    </EditorFrame>
  );
}

function FilmstripPanel() {
  const { beginDrag, addClips, setPreview } = useFrame();
  const [query, setQuery] = useState("");
  const [filterIdx, setFilterIdx] = useState(0);
  const [selected, setSelected] = useState<string>(ASSETS[0].id);
  const [scrub, setScrub] = useState<Scrub | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const filter = FILTERS[filterIdx];
  const items = useMemo(
    () => sortAssets(ASSETS.filter((a) => (filter === "all" || a.kind === filter) && matchesQuery(a, query)), "added", "desc"),
    [filter, query],
  );

  useEffect(() => {
    if (!items.some((a) => a.id === selected) && items[0]) setSelected(items[0].id);
  }, [items, selected]);

  const shown: Asset | undefined = (scrub && items.find((a) => a.id === scrub.id)) || items.find((a) => a.id === selected);
  const shownFrac = scrub && shown && scrub.id === shown.id ? scrub.frac : 0;

  useEffect(() => {
    setPreview(shown ?? null);
  }, [shown, setPreview]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = Math.max(0, items.findIndex((a) => a.id === selected));
    let next = idx;
    if (e.key === "ArrowRight") next = Math.min(items.length - 1, idx + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, idx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "Enter" && items[idx]) { e.preventDefault(); addClips([items[idx]]); return; }
    else return;
    e.preventDefault();
    setSelected(items[next].id);
    setScrub(null);
    stripRef.current?.querySelector<HTMLElement>(`[data-id="${items[next].id}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="text-sm font-medium">Media</span>
        <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
        <div className="ml-auto w-44">
          <InputGroup size="compact">
            <InputField index={0} label="Search" labelHidden icon={Search} placeholder="Search" value={query} onChange={setQuery} />
          </InputGroup>
        </div>
      </header>

      <div className="shrink-0 border-b border-border px-1">
        <TabsSubtle size="compact" selectedIndex={filterIdx} onSelect={setFilterIdx} idPrefix="fs-filter" aria-label="Filter by kind">
          {FILTERS.map((f, i) => (
            <TabsSubtleItem key={f} index={i} label={f === "all" ? "All" : KIND_LABEL[f]} />
          ))}
        </TabsSubtle>
      </div>

      {/* Strip */}
      <div className="shrink-0 pt-3" onPointerLeave={() => setScrub(null)}>
        <div className="mb-1.5 flex items-center justify-between px-3 text-[11px] text-muted-foreground">
          <span>Hover a thumbnail to scrub</span>
          <span>← → to move</span>
        </div>
        <ScrollArea orientation="horizontal" className="w-full">
          <div ref={stripRef} role="listbox" aria-label="Filmstrip" tabIndex={0} onKeyDown={onKeyDown} className="flex gap-2 px-3 pb-3 outline-none">
            {items.map((a) => (
              <StripThumb
                key={a.id}
                asset={a}
                selected={selected === a.id}
                scrubFrac={scrub?.id === a.id ? scrub.frac : null}
                onScrub={(frac) => setScrub({ id: a.id, frac })}
                onPointerDown={(e) => { setSelected(a.id); beginDrag(a, e); }}
                onDoubleClick={() => addClips([a])}
              />
            ))}
            {items.length === 0 && <div className="w-full py-8 text-center text-xs text-muted-foreground">No matches.</div>}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Detail pane */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-border">
        {shown ? (
          <>
            <div className="relative shrink-0 p-3">
              <div
                className="relative cursor-grab touch-none overflow-hidden rounded-lg active:cursor-grabbing"
                onPointerDown={(e) => beginDrag(shown, e)}
              >
                <BigFrame asset={shown} frac={shownFrac} />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={shown.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={spring.moderate}
                  className="mt-3 flex items-start gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{shown.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {tagsOf(shown).map((t) => (
                        <span key={t} className="rounded-[4px] bg-surface-4 px-1.5 py-px text-[10px] text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                  <Button variant="secondary" size="compact" leadingIcon={Plus} onClick={() => addClips([shown])}>Add</Button>
                </motion.div>
              </AnimatePresence>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 px-3 pb-3 text-xs">
                <Row k="Kind" v={KIND_LABEL[shown.kind]} />
                {shown.kind !== "image" && <Row k="Duration" v={`${shortDuration(shown.duration)} (${timecode(shown.duration, shown.fps ?? 30)})`} />}
                {shown.width && <Row k="Resolution" v={resolution(shown)} />}
                {shown.fps && <Row k="Frame rate" v={`${shown.fps} fps`} />}
                <Row k="Size" v={fileSize(shown.size)} />
                <Row k="Added" v={relativeTime(shown.addedAt)} />
                {shown.kind !== "image" && <Row k="Scrub" v={timecode(shownFrac * shown.duration, shown.fps ?? 30)} />}
              </dl>
            </ScrollArea>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-xs text-muted-foreground">Select a clip to see details.</div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate tabular-nums">{v}</dd>
    </>
  );
}

interface StripThumbProps {
  asset: Asset;
  selected: boolean;
  scrubFrac: number | null;
  onScrub: (frac: number) => void;
  onPointerDown: (e: ReactPointerEvent) => void;
  onDoubleClick: () => void;
}

function StripThumb({ asset, selected, scrubFrac, onScrub, onPointerDown, onDoubleClick }: StripThumbProps) {
  const scrubbable = asset.kind !== "image";
  return (
    <div
      role="option"
      aria-selected={selected}
      data-id={asset.id}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onPointerMove={(e) => {
        if (!scrubbable) return;
        const r = e.currentTarget.getBoundingClientRect();
        onScrub(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
      }}
      className={cn(
        "relative w-40 shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-md active:cursor-grabbing",
        selected ? "ring-2 ring-foreground ring-offset-1 ring-offset-surface-2" : "hover:ring-1 hover:ring-border",
      )}
    >
      <Frame asset={asset} frac={scrubFrac ?? 0} className="aspect-video w-full" />
      <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-[4px] bg-black/45 text-white"><KindIcon kind={asset.kind} size={11} /></span>
      {scrubFrac !== null && scrubbable && (
        <>
          <div className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]" style={{ left: `${scrubFrac * 100}%` }} />
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-[4px] bg-black/65 px-1 py-px text-[10px] tabular-nums text-white">{timecode(scrubFrac * asset.duration, asset.fps ?? 30)}</span>
        </>
      )}
      {scrubFrac === null && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-white">
          <span className="truncate">{asset.name}</span>
          {scrubbable && <span className="ml-1 shrink-0 tabular-nums">{shortDuration(asset.duration)}</span>}
        </div>
      )}
    </div>
  );
}

/** A thumbnail whose fake frame shifts with the scrub fraction. */
function Frame({ asset, frac, className }: { asset: Asset; frac: number; className?: string }) {
  if (asset.kind === "audio") {
    const bars = waveform(asset.id, 48);
    return (
      <div className={cn("relative flex items-center gap-px px-2", className)} style={{ background: `color-mix(in oklab, ${asset.tint} 18%, var(--surface-3))` }}>
        {bars.map((v, i) => (
          <span key={i} className="flex-1 rounded-full transition-opacity duration-80" style={{ height: `${v * 64}%`, background: asset.tint, opacity: i / bars.length <= frac || frac === 0 ? 1 : 0.35 }} />
        ))}
      </div>
    );
  }
  if (asset.kind === "image") return <Thumb asset={asset} className={className} />;
  const angle = 120 + frac * 60;
  const pos = 30 + frac * 40;
  return (
    <div
      className={cn("relative", className)}
      style={{ background: `radial-gradient(circle at ${pos}% ${100 - pos}%, rgba(255,255,255,.28) 0, transparent 40%), linear-gradient(${angle}deg, ${asset.tint} 0%, color-mix(in oklab, ${asset.tint} 50%, #000) 100%)` }}
    />
  );
}

function BigFrame({ asset, frac }: { asset: Asset; frac: number }) {
  return (
    <div className="relative">
      <Frame asset={asset} frac={frac} className="aspect-video w-full" />
      {asset.kind !== "image" && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div className="h-full bg-white/90" style={{ width: `${frac * 100}%` }} />
          </div>
          <span className="absolute bottom-3 right-2 rounded-[4px] bg-black/60 px-1.5 py-0.5 text-[11px] tabular-nums text-white">
            {timecode(frac * asset.duration, asset.fps ?? 30)} / {timecode(asset.duration, asset.fps ?? 30)}
          </span>
          <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-black/50 text-white"><Play size={11} strokeWidth={2} /></span>
        </>
      )}
    </div>
  );
}
