/**
 * The font picker used everywhere in the editor: search, a preview sentence
 * that re-renders every row, category tabs, favourites and recents shelves,
 * and a virtualised list over the whole catalogue. Clicking a row applies the
 * font immediately.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type UIEvent } from "react";
import { Clock, Search, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import { ensureFontLoaded } from "#/editor/core";
import { CATEGORY_TINT, FONT_BY_NAME, FONT_CATALOGUE, fontFamilyFor, type FontCategory, type FontEntry } from "./fonts";

const ROW = 52;
const OVERSCAN = 6;
const CATEGORIES: ("All" | FontCategory)[] = ["All", "Sans", "Serif", "Display", "Mono", "Korean"];
/** Tab captions; the category values themselves stay as stored on the catalogue. */
const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  All: "전체",
  Sans: "고딕",
  Serif: "명조",
  Display: "디스플레이",
  Mono: "고정폭",
  Korean: "한글",
};
const FAV_KEY = "aicccut.fonts.favourites";
const RECENT_KEY = "aicccut.fonts.recent";

function readList(key: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : fallback;
  } catch {
    return fallback;
  }
}

function writeList(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — shelves stay in memory for this session */
  }
}

/** Favourites and recents, persisted per browser. Read after mount (SSR-safe). */
function useShelves() {
  const [favourites, setFavourites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    setFavourites(readList(FAV_KEY, ["Pretendard", "Playfair Display", "JetBrains Mono"]));
    setRecents(readList(RECENT_KEY, []));
  }, []);

  const toggleFavourite = (name: string) =>
    setFavourites((f) => {
      const next = f.includes(name) ? f.filter((n) => n !== name) : [name, ...f];
      writeList(FAV_KEY, next);
      return next;
    });

  const remember = (name: string) =>
    setRecents((r) => {
      const next = [name, ...r.filter((n) => n !== name)].slice(0, 6);
      writeList(RECENT_KEY, next);
      return next;
    });

  return { favourites, recents, toggleFavourite, remember };
}

export interface FontBrowserProps {
  value: string;
  onChange: (font: string) => void;
  /** Sentence the rows render; falls back to a pangram when empty. */
  previewText?: string;
  className?: string;
}

export function FontBrowser({ value, onChange, previewText, className }: FontBrowserProps) {
  const { favourites, recents, toggleFavourite, remember } = useShelves();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [query, setQuery] = useState("");
  const [sentence, setSentence] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);
  const listRef = useRef<HTMLDivElement>(null);

  const preview = sentence.trim() || previewText?.trim() || "다람쥐 헌 쳇바퀴에 타고파 Aa";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FONT_CATALOGUE.filter((f) => (category === "All" || f.category === category) && (!q || f.name.toLowerCase().includes(q)));
  }, [category, query]);

  const pick = (name: string) => {
    onChange(name);
    remember(name);
  };

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    if (e.currentTarget.clientHeight !== viewportH) setViewportH(e.currentTarget.clientHeight);
  };
  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewportH) / ROW) + OVERSCAN);
  const visible = rows.slice(first, last);
  const showShelves = !query && category === "All";

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex shrink-0 flex-col gap-2 border-b border-border p-3">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="글꼴 검색"
            className="h-8 bg-surface-3 pl-7 text-[12px]"
          />
        </div>
        <Input
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="미리보기 문장 (비우면 클립의 텍스트)"
          className="h-8 bg-surface-3 text-[12px]"
        />
        <Tabs
          size="compact"
          value={category}
          onValueChange={(v) => {
            setCategory(v as typeof category);
            setScrollTop(0);
            listRef.current?.scrollTo({ top: 0 });
          }}
        >
          <TabsList aria-label="글꼴 분류" className="w-full">
            {CATEGORIES.map((c) => (
              <TabItem key={c} value={c} label={CATEGORY_LABEL[c]} />
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]" onScroll={onScroll}>
        {showShelves && (
          <>
            <Shelf icon={<Star size={11} />} title="즐겨찾기" names={favourites} preview={preview} current={value} favourites={favourites} onPick={pick} onFav={toggleFavourite} empty="별표를 누르면 여기에 모입니다" />
            <Shelf icon={<Clock size={11} />} title="최근 사용" names={recents} preview={preview} current={value} favourites={favourites} onPick={pick} onFav={toggleFavourite} empty="아직 없습니다" />
            <ShelfTitle>
              전체 글꼴 <span className="ml-1 tabular-nums text-muted-foreground/70">{rows.length.toLocaleString()}</span>
            </ShelfTitle>
          </>
        )}
        {!showShelves && (
          <ShelfTitle>
            글꼴 {rows.length.toLocaleString()}개
          </ShelfTitle>
        )}
        <div style={{ height: rows.length * ROW, position: "relative" }}>
          {visible.map((f, i) => (
            <FontRow
              key={f.id}
              font={f}
              preview={preview}
              current={f.name === value}
              fav={favourites.includes(f.name)}
              onPick={() => pick(f.name)}
              onFav={() => toggleFavourite(f.name)}
              style={{ position: "absolute", top: (first + i) * ROW, height: ROW, left: 0, right: 0 }}
            />
          ))}
          {rows.length === 0 && <div className="p-6 text-center text-[12px] text-muted-foreground">“{query}”에 맞는 글꼴이 없습니다</div>}
        </div>
      </div>
    </div>
  );
}

function ShelfTitle({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-surface-2/95 px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
      {children}
    </div>
  );
}

interface ShelfProps {
  icon: ReactNode;
  title: string;
  names: string[];
  preview: string;
  current: string;
  favourites: string[];
  onPick: (n: string) => void;
  onFav: (n: string) => void;
  empty: string;
}

function Shelf({ icon, title, names, preview, current, favourites, onPick, onFav, empty }: ShelfProps) {
  return (
    <div className="border-b border-border pb-1">
      <ShelfTitle>
        {icon}
        {title}
      </ShelfTitle>
      {names.length === 0 && <div className="px-3 pb-2 text-[11px] text-muted-foreground/70">{empty}</div>}
      {names.map((n) => {
        const f = FONT_BY_NAME.get(n);
        return f ? (
          <FontRow key={n} font={f} preview={preview} current={current === n} fav={favourites.includes(n)} onPick={() => onPick(n)} onFav={() => onFav(n)} style={{ height: ROW }} />
        ) : null;
      })}
    </div>
  );
}

interface FontRowProps {
  font: FontEntry;
  preview: string;
  current: boolean;
  fav: boolean;
  onPick: () => void;
  onFav: () => void;
  style: CSSProperties;
}

function FontRow({ font, preview, current, fav, onPick, onFav, style }: FontRowProps) {
  // Rows are virtualised, so only the ones on screen fetch their family.
  useEffect(() => ensureFontLoaded(font.name), [font.name]);
  return (
    <div
      role="option"
      aria-selected={current}
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 px-3 outline-none focus-visible:bg-hover",
        current ? "bg-selected" : "hover:bg-hover active:bg-active",
      )}
      style={style}
    >
      <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: CATEGORY_TINT[font.category], opacity: current ? 1 : 0.5 }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] leading-tight" style={{ fontFamily: fontFamilyFor(font.name) }}>
          {preview}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="truncate">{font.name}</span>
          <span>·</span>
          <span className="shrink-0">{CATEGORY_LABEL[font.category]}</span>
        </div>
      </div>
      <button
        type="button"
        aria-label={fav ? "즐겨찾기에서 제거" : "즐겨찾기에 추가"}
        aria-pressed={fav}
        onClick={(e) => {
          e.stopPropagation();
          onFav();
        }}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md outline-none transition-opacity hover:bg-active focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40",
          fav ? "text-[#FFD166] opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100",
        )}
      >
        <Star size={13} fill={fav ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

/** The browser in a dialog — the Font field of every panel opens this. */
export function FontPickerDialog({
  open,
  onOpenChange,
  value,
  onChange,
  previewText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (font: string) => void;
  previewText?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="flex h-[min(660px,82dvh)] flex-col overflow-hidden p-0">
        <DialogHeader className="mb-0 shrink-0 gap-0.5 border-b border-border px-4 py-3">
          <DialogTitle className="text-[13px]">글꼴</DialogTitle>
          <DialogDescription className="text-[11px]">글꼴을 클릭하면 선택한 텍스트에 바로 적용됩니다.</DialogDescription>
        </DialogHeader>
        <FontBrowser value={value} onChange={onChange} previewText={previewText} className="flex-1" />
      </DialogContent>
    </Dialog>
  );
}
