import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "#/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select";
import { ColorPickerPopover } from "#/components/ui/color-picker";
import { Tooltip } from "#/components/ui/tooltip";
import { BLEND_MODES, CLIPS, FONTS } from "#/prototypes/mock";

// ── Element model ────────────────────────────────────────

export type BlendMode = (typeof BLEND_MODES)[number];

export interface ElementProps {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  blend: BlendMode;
  font: string;
  fontSize: number;
  weight: number;
  letterSpacing: number;
  lineHeight: number;
  color: string;
  fillEnabled: boolean;
  fill: string;
  fillPadding: number;
  fillRadius: number;
}

export type PropKey = keyof ElementProps;

export const SELECTED_CLIP = CLIPS.find((c) => c.id === "c10")!;

/** Neutral defaults every "reset" returns to. */
export const DEFAULTS: ElementProps = {
  x: 0,
  y: 0,
  scale: 100,
  rotation: 0,
  opacity: 100,
  blend: "Normal",
  font: "Inter",
  fontSize: 64,
  weight: 400,
  letterSpacing: 0,
  lineHeight: 1.2,
  color: "#FFFFFF",
  fillEnabled: false,
  fill: "#111111",
  fillPadding: 24,
  fillRadius: 12,
};

/** What the selected title card looks like when the panel opens. */
export const INITIAL: ElementProps = {
  ...DEFAULTS,
  y: 300,
  fontSize: 88,
  weight: 700,
  font: "Pretendard",
  letterSpacing: -2,
  fillEnabled: true,
  fill: "#0B0B0F",
  fillPadding: 28,
  fillRadius: 16,
};

export type SectionId = "transform" | "blending" | "typography" | "background";

export const SECTIONS: Record<SectionId, { title: string; keys: PropKey[] }> = {
  transform: { title: "Transform", keys: ["x", "y", "scale", "rotation"] },
  blending: { title: "Blending", keys: ["opacity", "blend"] },
  typography: { title: "Typography", keys: ["font", "fontSize", "weight", "letterSpacing", "lineHeight", "color"] },
  background: { title: "Background", keys: ["fillEnabled", "fill", "fillPadding", "fillRadius"] },
};

export const PROP_LABEL: Record<PropKey, string> = {
  x: "Position X",
  y: "Position Y",
  scale: "Scale",
  rotation: "Rotation",
  opacity: "Opacity",
  blend: "Blend mode",
  font: "Font",
  fontSize: "Font size",
  weight: "Weight",
  letterSpacing: "Letter spacing",
  lineHeight: "Line height",
  color: "Text color",
  fillEnabled: "Background",
  fill: "Fill color",
  fillPadding: "Padding",
  fillRadius: "Corner radius",
};

export interface ElementApi {
  props: ElementProps;
  set: <K extends PropKey>(key: K, value: ElementProps[K]) => void;
  reset: (keys: readonly PropKey[]) => void;
  isDefault: (keys: readonly PropKey[]) => boolean;
  /** Keys changed most recently, newest first. */
  recent: PropKey[];
}

export function useElement(): ElementApi {
  const [props, setProps] = useState<ElementProps>(INITIAL);
  const [recent, setRecent] = useState<PropKey[]>([]);

  const set = useCallback(<K extends PropKey>(key: K, value: ElementProps[K]) => {
    setProps((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    setRecent((prev) => (prev[0] === key ? prev : [key, ...prev.filter((k) => k !== key)].slice(0, 4)));
  }, []);

  const reset = useCallback((keys: readonly PropKey[]) => {
    setProps((prev) => {
      const next = { ...prev };
      for (const k of keys) (next as Record<PropKey, unknown>)[k] = DEFAULTS[k];
      return next;
    });
  }, []);

  const isDefault = useCallback((keys: readonly PropKey[]) => keys.every((k) => props[k] === DEFAULTS[k]), [props]);

  return { props, set, reset, isDefault, recent };
}

// ── Math expressions ─────────────────────────────────────

/**
 * Evaluates "100+20", "(3+4)*2", "*2" (relative to `current`), "50%" → 50.
 * Returns null when the text isn't a valid expression.
 */
export function evaluateExpression(source: string, current: number): number | null {
  let src = source.replace(/[a-z°%\s]/gi, "");
  if (!src) return null;
  if (/^[*/+]/.test(src)) src = `${current}${src}`;
  let i = 0;
  const peek = () => src[i];
  const parseNumber = (): number | null => {
    const m = /^-?\d*\.?\d+/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const parseFactor = (): number | null => {
    if (peek() === "(") {
      i++;
      const v = parseExpr();
      if (peek() !== ")") return null;
      i++;
      return v;
    }
    if (peek() === "-" ) {
      i++;
      const v = parseFactor();
      return v === null ? null : -v;
    }
    return parseNumber();
  };
  const parseTerm = (): number | null => {
    let left = parseFactor();
    while (left !== null && (peek() === "*" || peek() === "/")) {
      const op = src[i++];
      const right = parseFactor();
      if (right === null) return null;
      left = op === "*" ? left * right : right === 0 ? null : left / right;
    }
    return left;
  };
  const parseExpr = (): number | null => {
    let left = parseTerm();
    while (left !== null && (peek() === "+" || peek() === "-")) {
      const op = src[i++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };
  const result = parseExpr();
  if (result === null || i !== src.length || !Number.isFinite(result)) return null;
  return result;
}

// ── Scrubbable number field ──────────────────────────────

export interface NumberFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "prefix"> {
  value: number;
  onChange: (value: number) => void;
  /** Accessible name; also the tooltip when `prefix` is a glyph. */
  label: string;
  min?: number;
  max?: number;
  /** Value change per pixel of drag and per arrow key press. */
  step?: number;
  precision?: number;
  /** Trailing unit, e.g. "px", "%", "°". */
  suffix?: string;
  /** Leading glyph or short label, e.g. "X" or an icon. */
  prefix?: ReactNode;
  size?: "default" | "compact";
  /** `field` draws a box; `bare` sits flush in a table-like row. */
  variant?: "field" | "bare";
}

function formatValue(v: number, precision: number) {
  return Number.isInteger(v) && precision === 0 ? String(v) : v.toFixed(precision);
}

export const NumberField = forwardRef<HTMLDivElement, NumberFieldProps>(function NumberField(
  { value, onChange, label, min = -Infinity, max = Infinity, step = 1, precision = 0, suffix, prefix, size = "default", variant = "field", className, ...rest },
  ref,
) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ startX: number; startValue: number; moved: boolean; pointerId: number } | null>(null);

  const clamp = useCallback(
    (v: number) => {
      const c = Math.min(max, Math.max(min, v));
      const p = 10 ** precision;
      return Math.round(c * p) / p;
    },
    [min, max, precision],
  );

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const beginEdit = () => {
    setText(formatValue(value, precision));
    setEditing(true);
  };

  const commit = () => {
    const next = evaluateExpression(text, value);
    if (next !== null) onChange(clamp(next));
    setEditing(false);
  };

  const nudge = (dir: 1 | -1, e: { shiftKey: boolean; altKey: boolean }) => {
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const next = clamp(value + dir * step * mult);
    onChange(next);
    if (editing) setText(formatValue(next, precision));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing || e.button !== 0) return;
    drag.current = { startX: e.clientX, startValue: value, moved: false, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved) {
      if (Math.abs(dx) < 3) return;
      d.moved = true;
      setDragging(true);
      document.body.style.cursor = "ew-resize";
    }
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    onChange(clamp(d.startValue + dx * step * mult));
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(d.pointerId)) e.currentTarget.releasePointerCapture(d.pointerId);
    document.body.style.cursor = "";
    setDragging(false);
    if (!d.moved) beginEdit();
  };

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    if (e.key === "ArrowUp") { e.preventDefault(); nudge(1, e); }
    else if (e.key === "ArrowDown") { e.preventDefault(); nudge(-1, e); }
    else if (e.key === "Enter" || (e.key.length === 1 && /[\d\-+*/.(]/.test(e.key))) {
      e.preventDefault();
      setText(e.key === "Enter" ? formatValue(value, precision) : e.key);
      setEditing(true);
    }
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
    else if (e.key === "ArrowUp") { e.preventDefault(); nudge(1, e); }
    else if (e.key === "ArrowDown") { e.preventDefault(); nudge(-1, e); }
  };

  const compact = size === "compact";

  return (
    <div
      ref={ref}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value}
      tabIndex={editing ? -1 : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onRootKeyDown}
      className={cn(
        "group/nf relative flex min-w-0 items-center select-none outline-none tabular-nums",
        compact ? "h-7 gap-1 px-1.5 text-[12px]" : "h-9 gap-1.5 px-2.5 text-[13px]",
        variant === "field" && "rounded-md bg-surface-3 shadow-surface-2 transition-colors duration-80 hover:bg-surface-4",
        variant === "bare" && "rounded-md hover:bg-hover",
        !editing && "cursor-ew-resize",
        dragging && "bg-active",
        "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] focus-within:ring-1 focus-within:ring-[color:var(--focus-ring,#6B97FF)]",
        className,
      )}
      {...rest}
    >
      {prefix !== undefined && (
        <span className={cn("shrink-0 text-muted-foreground", compact ? "min-w-3 text-[11px]" : "min-w-3.5 text-[12px]", "font-medium")}>{prefix}</span>
      )}
      {editing ? (
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={onInputKeyDown}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none tabular-nums"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-foreground">{formatValue(value, precision)}</span>
      )}
      {suffix && !editing && <span className="shrink-0 text-muted-foreground">{suffix}</span>}
    </div>
  );
});

// ── Small shared controls ────────────────────────────────

const SCALES: Partial<Record<PropKey, Pick<NumberFieldProps, "min" | "max" | "step" | "precision" | "suffix">>> = {
  x: { min: -1920, max: 1920, step: 2 },
  y: { min: -1080, max: 1080, step: 2 },
  scale: { min: 1, max: 1000, step: 0.5, suffix: "%" },
  rotation: { min: -360, max: 360, step: 0.5, suffix: "°" },
  opacity: { min: 0, max: 100, step: 0.5, suffix: "%" },
  fontSize: { min: 4, max: 800, step: 1 },
  weight: { min: 100, max: 900, step: 4 },
  letterSpacing: { min: -40, max: 100, step: 0.2, precision: 1 },
  lineHeight: { min: 0.5, max: 4, step: 0.01, precision: 2 },
  fillPadding: { min: 0, max: 200, step: 1 },
  fillRadius: { min: 0, max: 200, step: 1 },
};

type NumericKey = { [K in PropKey]: ElementProps[K] extends number ? K : never }[PropKey];

/** NumberField bound to one numeric element property with its natural range. */
export function PropField({
  api,
  k,
  ...rest
}: { api: ElementApi; k: NumericKey } & Omit<NumberFieldProps, "value" | "onChange" | "label">) {
  return <NumberField label={PROP_LABEL[k]} value={api.props[k]} onChange={(v) => api.set(k, v)} {...SCALES[k]} {...rest} />;
}

export function BlendSelect({ api, size }: { api: ElementApi; size?: "default" | "compact" }) {
  return (
    <Select value={api.props.blend} onValueChange={(v) => api.set("blend", v as BlendMode)} size={size}>
      <SelectTrigger aria-label="Blend mode" className="w-full" />
      <SelectContent>
        {BLEND_MODES.map((m, i) => (
          <SelectItem key={m} index={i} value={m}>{m}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FontSelect({ api, size }: { api: ElementApi; size?: "default" | "compact" }) {
  return (
    <Select value={api.props.font} onValueChange={(v) => api.set("font", v)} size={size}>
      <SelectTrigger aria-label="Font" className="w-full" />
      <SelectContent className="max-h-72">
        {FONTS.map((f, i) => (
          <SelectItem key={f} index={i} value={f}>
            <span style={{ fontFamily: `"${f}", sans-serif` }}>{f}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ColorField({
  api,
  k,
  size,
  label,
  className,
}: { api: ElementApi; k: "color" | "fill"; size?: "default" | "compact"; label?: string; className?: string }) {
  return (
    <ColorPickerPopover
      value={api.props[k]}
      onValueChange={(v) => api.set(k, v)}
      defaultFormat="hex"
      swatches={["#FFFFFF", "#FEF148", "#FF6B6B", "#2EC4B6", "#5B6CFF", "#0B0B0F"]}
      triggerLabel={label}
      triggerShowValue
      size={size}
      triggerClassName={cn("w-full", className)}
    />
  );
}

/** Small circular reset button used in section headers. */
export function ResetButton({ onClick, disabled, compact }: { onClick: () => void; disabled?: boolean; compact?: boolean }) {
  return (
    <Tooltip content="Reset to default" side="bottom">
      <button
        type="button"
        aria-label="Reset to default"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "grid shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-80",
          "hover:bg-hover hover:text-foreground active:bg-active focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          "disabled:pointer-events-none disabled:opacity-30",
          compact ? "size-5" : "size-6",
        )}
      >
        <RotateCcw size={compact ? 11 : 12} strokeWidth={1.75} />
      </button>
    </Tooltip>
  );
}

/** Label-left, control-right row. */
export function Row({ label, children, className, compact }: { label: ReactNode; children: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("grid items-center gap-2", compact ? "grid-cols-[72px_1fr]" : "grid-cols-[96px_1fr]", className)}>
      <span className={cn("truncate text-muted-foreground", compact ? "text-[11px]" : "text-[12px]")}>{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
