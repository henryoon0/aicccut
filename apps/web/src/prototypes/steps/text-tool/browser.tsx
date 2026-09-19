import { useMemo, useRef, useState, type UIEvent } from "react";
import { Clock, Search, Star } from "lucide-react";
import { ColorPickerPopover } from "#/components/ui/color-picker";
import { Input } from "#/components/ui/input";
import { Slider } from "#/components/ui/slider";
import { Tabs, TabItem, TabsList } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import { AlignTabs } from "./controls";
import { Canvas, EditorFrame, TextElement } from "./frame";
import { CATEGORY_TINT, FONT_BY_NAME, FONT_CATALOGUE, SWATCHES, fontFamilyFor, useTextElement, type FontCategory, type FontEntry } from "./shared";

const ROW = 52;
const OVERSCAN = 6;
const CATEGORIES: ("All" | FontCategory)[] = ["All", "Sans", "Serif", "Display", "Mono", "Korean"];

/**
 * Browser — a full-height font browser owns the left edge. Preview sentence,
 * category filter, favourites, recents and a virtualised 1,000+ list; every
 * click applies live to the canvas.
 */
export function Browser() {
  const { text, update } = useTextElement();
  const [selected, setSelected] = useState(true);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [query, setQuery] = useState("");
  const [sentence, setSentence] = useState("");
  const [favourites, setFavourites] = useState<string[]>(["Pretendard", "Playfair Display", "JetBrains Mono"]);
  const [recents, setRecents] = useState<string[]>(["Inter", "Noto Sans KR", "Black Han Sans"]);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);
  const listRef = useRef<HTMLDivElement>(null);

  const preview = sentence.trim() || text.content;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FONT_CATALOGUE.filter((f) => (category === "All" || f.category === category) && (!q || f.name.toLowerCase().includes(q)));
  }, [category, query]);

  const pick = (name: string) => {
    update({ font: name });
    setSelected(true);
    setRecents((r) => [name, ...r.filter((n) => n !== name)].slice(0, 6));
  };
  const toggleFav = (name: string) => setFavourites((f) => (f.includes(name) ? f.filter((n) => n !== name) : [name, ...f]));

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    if (e.currentTarget.clientHeight !== viewportH) setViewportH(e.currentTarget.clientHeight);
  };
  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewportH) / ROW) + OVERSCAN);
  const visible = rows.slice(first, last);

  const showShelves = !query && category === "All";

  return (
    <EditorFrame
      left={
        <aside className="flex w-[360px] shrink-0 flex-col border-r border-border bg-surface-2">
          <div className="flex flex-col gap-2 border-b border-border p-3">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${FONT_CATALOGUE.length.toLocaleString()} fonts`} className="h-8 bg-surface-3 pl-7 text-[12px]" />
            </div>
            <Input value={sentence} onChange={(e) => setSentence(e.target.value)} placeholder="Preview sentence (defaults to your text)" className="h-8 bg-surface-3 text-[12px]" />
            <Tabs size="compact" value={category} onValueChange={(v) => { setCategory(v as typeof category); listRef.current?.scrollTo({ top: 0 }); }}>
              <TabsList aria-label="Font category" className="w-full">
                {CATEGORIES.map((c) => <TabItem key={c} value={c} label={c} />)}
              </TabsList>
            </Tabs>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]" onScroll={onScroll}>
            {showShelves && (
              <>
                <Shelf icon={<Star size={11} />} title="Favourites" names={favourites} preview={preview} current={text.font} favourites={favourites} onPick={pick} onFav={toggleFav} empty="Star a font to keep it here" />
                <Shelf icon={<Clock size={11} />} title="Recently used" names={recents} preview={preview} current={text.font} favourites={favourites} onPick={pick} onFav={toggleFav} empty="Nothing yet" />
                <ShelfTitle>All fonts <span className="ml-1 tabular-nums text-muted-foreground/70">{rows.length.toLocaleString()}</span></ShelfTitle>
              </>
            )}
            {!showShelves && <ShelfTitle>{rows.length.toLocaleString()} {rows.length === 1 ? "font" : "fonts"}</ShelfTitle>}
            <div style={{ height: rows.length * ROW, position: "relative" }}>
              {visible.map((f, i) => (
                <FontRow key={f.id} font={f} preview={preview} current={f.name === text.font} fav={favourites.includes(f.name)} onPick={() => pick(f.name)} onFav={() => toggleFav(f.name)} style={{ position: "absolute", top: (first + i) * ROW, height: ROW }} />
              ))}
              {rows.length === 0 && <div className="p-6 text-center text-[12px] text-muted-foreground">No fonts match “{query}”</div>}
            </div>
          </div>
        </aside>
      }
      below={
        <div className="flex h-11 shrink-0 items-center gap-3 border-t border-border px-4 text-[12px]">
          <span className="w-[160px] truncate" style={{ fontFamily: fontFamilyFor(text.font) }}>{text.font}</span>
          <span className="text-muted-foreground">Size</span>
          <Slider size="compact" className="w-[180px]" value={text.size} min={16} max={240} step={2} onChange={(v) => typeof v === "number" && update({ size: v })} />
          <AlignTabs value={text.align} onChange={(align) => update({ align })} className="ml-auto" />
          <ColorPickerPopover size="compact" value={text.color} swatches={SWATCHES} triggerShowValue={false} onValueChange={(color) => update({ color })} />
        </div>
      }
    >
      <Canvas onBackgroundClick={() => setSelected(false)}>
        {(scale, ref) => (
          <TextElement text={text} scale={scale} canvasRef={ref} selected={selected} onSelect={() => setSelected(true)} onMove={(x, y) => update({ x, y })} />
        )}
      </Canvas>
    </EditorFrame>
  );
}

function ShelfTitle({ children }: { children: React.ReactNode }) {
  return <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-surface-2/95 px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">{children}</div>;
}

interface ShelfProps {
  icon: React.ReactNode; title: string; names: string[]; preview: string; current: string; favourites: string[];
  onPick: (n: string) => void; onFav: (n: string) => void; empty: string;
}

function Shelf({ icon, title, names, preview, current, favourites, onPick, onFav, empty }: ShelfProps) {
  return (
    <div className="border-b border-border pb-1">
      <ShelfTitle>{icon}{title}</ShelfTitle>
      {names.length === 0 && <div className="px-3 pb-2 text-[11px] text-muted-foreground/70">{empty}</div>}
      {names.map((n) => {
        const f = FONT_BY_NAME.get(n);
        return f ? <FontRow key={n} font={f} preview={preview} current={current === n} fav={favourites.includes(n)} onPick={() => onPick(n)} onFav={() => onFav(n)} style={{ height: ROW }} /> : null;
      })}
    </div>
  );
}

interface FontRowProps { font: FontEntry; preview: string; current: boolean; fav: boolean; onPick: () => void; onFav: () => void; style: React.CSSProperties }

function FontRow({ font, preview, current, fav, onPick, onFav, style }: FontRowProps) {
  return (
    <div
      role="option"
      aria-selected={current}
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } }}
      className={cn("group flex w-full cursor-pointer items-center gap-2 px-3 outline-none focus-visible:bg-hover", current ? "bg-selected" : "hover:bg-hover active:bg-active")}
      style={style}
    >
      <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: CATEGORY_TINT[font.category], opacity: current ? 1 : 0.5 }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] leading-tight" style={{ fontFamily: fontFamilyFor(font.name) }}>{preview}</div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="truncate">{font.name}</span>
          <span>·</span>
          <span className="shrink-0">{font.styles} {font.styles === 1 ? "style" : "styles"}</span>
        </div>
      </div>
      <button
        type="button"
        aria-label={fav ? "Remove from favourites" : "Add to favourites"}
        aria-pressed={fav}
        onClick={(e) => { e.stopPropagation(); onFav(); }}
        className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md outline-none transition-opacity hover:bg-active focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40", fav ? "text-[#FFD166] opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100")}
      >
        <Star size={13} fill={fav ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
