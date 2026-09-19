import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "#/lib/utils";
import { FONTS } from "#/prototypes/mock";

// ── Text element model ────────────────────────────────────

export type Align = "left" | "center" | "right";

export interface TextStyle {
  content: string;
  font: string;
  /** Font size in canvas pixels (1920-wide canvas). */
  size: number;
  weight: number;
  italic: boolean;
  /** Letter spacing in em × 100 (so 0 = normal, -5 = -0.05em). */
  tracking: number;
  /** Unitless line height × 100 (120 = 1.2). */
  leading: number;
  color: string;
  align: Align;
  /** Centre of the element, as a % of canvas width / height. */
  x: number;
  y: number;
}

export const DEFAULT_TEXT: TextStyle = {
  content: "훅(Hook)이란 무엇인가",
  font: "Pretendard",
  size: 96,
  weight: 700,
  italic: false,
  tracking: -2,
  leading: 120,
  color: "#FFFFFF",
  align: "center",
  x: 50,
  y: 50,
};

export const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
export const WEIGHT_LABEL: Record<number, string> = {
  100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium",
  600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black",
};

export const SWATCHES = ["#FFFFFF", "#0A0A0A", "#FFD166", "#5B6CFF", "#FF6B6B", "#2EC4B6", "#F4A261", "#C77DFF"];

export function useTextElement(initial: TextStyle = DEFAULT_TEXT) {
  const [text, setText] = useState<TextStyle>(initial);
  const update = useCallback(
    (patch: Partial<TextStyle> | ((prev: TextStyle) => Partial<TextStyle>)) =>
      setText((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) })),
    []
  );
  return { text, update, setText } as const;
}

/** CSS for the element at a given canvas scale (canvas px → screen px). */
export function textCss(t: TextStyle, scale: number): CSSProperties {
  return {
    fontFamily: `"${t.font}", "Pretendard", "Inter Variable", system-ui, sans-serif`,
    fontSize: t.size * scale,
    fontWeight: t.weight,
    fontStyle: t.italic ? "italic" : "normal",
    letterSpacing: `${t.tracking / 100}em`,
    lineHeight: t.leading / 100,
    color: t.color,
    textAlign: t.align,
  };
}

// ── Font catalogue (1,000+ entries synthesised from the mock sample) ──

export type FontCategory = "Sans" | "Serif" | "Display" | "Mono" | "Korean";

export interface FontEntry {
  /** Unique id used as the value. */
  id: string;
  /** Display name, also used as the CSS family. */
  name: string;
  /** Family the browser should try — base family for synthesised variants. */
  family: string;
  category: FontCategory;
  styles: number;
}

const KOREAN = new Set(["Pretendard", "Noto Sans KR", "Gothic A1", "Nanum Myeongjo", "Nanum Gothic", "Black Han Sans", "Do Hyeon", "Jua", "Gowun Dodum", "Gowun Batang", "Hahmlet", "Song Myung", "Sunflower", "Poor Story"]);
const SERIF = new Set(["Playfair Display", "Fraunces", "Lora", "Instrument Serif", "Nanum Myeongjo", "Gowun Batang", "Hahmlet", "Song Myung"]);
const MONO = new Set(["IBM Plex Mono", "JetBrains Mono", "Geist Mono"]);
const DISPLAY = new Set(["Bricolage Grotesque", "Black Han Sans", "Do Hyeon", "Jua", "Poor Story", "Sora", "Outfit"]);

export function categoryOf(name: string): FontCategory {
  if (KOREAN.has(name) && !SERIF.has(name) && !DISPLAY.has(name)) return "Korean";
  if (MONO.has(name)) return "Mono";
  if (SERIF.has(name)) return "Serif";
  if (DISPLAY.has(name)) return "Display";
  return "Sans";
}

const SUFFIXES = ["", "Text", "Display", "Condensed", "Narrow", "Tight", "Wide", "Rounded", "Expanded", "Compact", "Headline", "Caption", "Semi Condensed", "Extra Condensed", "Book", "Poster", "Micro", "Variable", "Neue", "Classic", "Modern", "Slab", "Mono", "Script", "Stencil", "Outline", "Inline", "Shadow", "Italic Pro", "SC", "Deck", "Banner", "Subhead", "Fine", "Grand", "Petit"];

function buildCatalogue(): FontEntry[] {
  const out: FontEntry[] = [];
  for (const base of FONTS) {
    const cat = categoryOf(base);
    for (const suffix of SUFFIXES) {
      const name = suffix ? `${base} ${suffix}` : base;
      // Deterministic pseudo-random style count so rows differ.
      const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
      out.push({ id: name.toLowerCase().replace(/\s+/g, "-"), name, family: base, category: suffix === "Mono" ? "Mono" : cat, styles: 1 + (seed % 9) });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export const FONT_CATALOGUE: FontEntry[] = buildCatalogue();
export const FONT_BY_NAME = new Map(FONT_CATALOGUE.map((f) => [f.name, f]));

export function fontFamilyFor(name: string): string {
  const f = FONT_BY_NAME.get(name);
  return `"${f?.family ?? name}", "Pretendard", "Inter Variable", system-ui, sans-serif`;
}

// ── Scrubbable number ─────────────────────────────────────

interface ScrubNumberProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Pixels of drag per step. */
  sensitivity?: number;
  suffix?: string;
  format?: (v: number) => string;
  className?: string;
  compact?: boolean;
}

/** A number field you can drag horizontally to scrub, or click to type. */
export function ScrubNumber({ label, value, onChange, min, max, step = 1, sensitivity = 3, suffix, format, className, compact }: ScrubNumberProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ startX: number; startV: number; moved: boolean } | null>(null);

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing) return;
    drag.current = { startX: e.clientX, startV: value, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 2) d.moved = true;
    if (d.moved) onChange(clamp(d.startV + (dx / sensitivity) * step));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      setDraft(String(value));
      setEditing(true);
    }
  };
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const n = parseFloat(draft);
    if (!Number.isNaN(n)) onChange(clamp(n));
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "group flex select-none items-center justify-between gap-2 rounded-md border border-border bg-surface-3 px-2 text-[12px] tabular-nums",
        compact ? "h-7" : "h-8",
        editing ? "border-ring ring-2 ring-ring/30" : "cursor-ew-resize hover:bg-hover active:bg-active",
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      title={`${label}: drag to scrub, click to type`}
    >
      <span className="truncate text-muted-foreground">{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
            if (e.key === "ArrowUp") { e.preventDefault(); onChange(clamp(value + step)); setDraft(String(clamp(value + step))); }
            if (e.key === "ArrowDown") { e.preventDefault(); onChange(clamp(value - step)); setDraft(String(clamp(value - step))); }
          }}
          className="w-14 bg-transparent text-right text-foreground outline-none"
        />
      ) : (
        <span className="text-foreground">
          {format ? format(value) : value}
          {suffix && <span className="ml-0.5 text-muted-foreground">{suffix}</span>}
        </span>
      )}
    </div>
  );
}

// ── Small stateless bits ──────────────────────────────────

export function FieldLabel({ children, className }: { children: string; className?: string }) {
  return <div className={cn("text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground", className)}>{children}</div>;
}

/** Font name rendered in its own family. */
export function FontName({ name, className, size = 13 }: { name: string; className?: string; size?: number }) {
  return (
    <span className={cn("truncate", className)} style={{ fontFamily: fontFamilyFor(name), fontSize: size }}>
      {name}
    </span>
  );
}

export const CATEGORY_TINT: Record<FontCategory, string> = {
  Sans: "#5b6cff",
  Serif: "#f4a261",
  Display: "#ff6b6b",
  Mono: "#2ec4b6",
  Korean: "#c77dff",
};
