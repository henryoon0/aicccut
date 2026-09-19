/**
 * Scrubbable number field, ported from the inspector prototype: drag sideways
 * to scrub (Shift ×10, Alt ×0.1), click to type a value or a small maths
 * expression ("100+20", "*2"), arrow keys to nudge.
 *
 * `onChange` fires on every step of a drag — callers pass `{ preview: true }`
 * through it and push history once in `onCommit`.
 */
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
import { cn } from "#/lib/utils";

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
    if (peek() === "-") {
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

export interface NumberFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "prefix"> {
  value: number;
  onChange: (value: number) => void;
  /** End of a scrub / typed edit — push one history entry here. */
  onCommit?: () => void;
  /** Accessible name. */
  label: string;
  min?: number;
  max?: number;
  /** Value change per pixel of drag and per arrow key press. */
  step?: number;
  precision?: number;
  /** Trailing unit, e.g. "px", "%", "°". */
  suffix?: string;
  /** Leading glyph or short label, e.g. "X". */
  prefix?: ReactNode;
  size?: "default" | "compact";
  /** `field` draws a box; `bare` sits flush in a table-like row. */
  variant?: "field" | "bare";
  /** Right-align the digits when the field ends a row. */
  align?: "left" | "right";
}

function format(v: number, precision: number) {
  return Number.isInteger(v) && precision === 0 ? String(v) : v.toFixed(precision);
}

export const NumberField = forwardRef<HTMLDivElement, NumberFieldProps>(function NumberField(
  { value, onChange, onCommit, label, min = -Infinity, max = Infinity, step = 1, precision = 0, suffix, prefix, size = "default", variant = "field", align = "left", className, ...rest },
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
    setText(format(value, precision));
    setEditing(true);
  };

  const commitText = () => {
    const next = evaluateExpression(text, value);
    if (next !== null) {
      onChange(clamp(next));
      onCommit?.();
    }
    setEditing(false);
  };

  const nudge = (dir: 1 | -1, e: { shiftKey: boolean; altKey: boolean }) => {
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const next = clamp(value + dir * step * mult);
    onChange(next);
    onCommit?.();
    if (editing) setText(format(next, precision));
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
    if (d.moved) onCommit?.();
    else beginEdit();
  };

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      nudge(1, e);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nudge(-1, e);
    } else if (e.key === "Enter" || (e.key.length === 1 && /[\d\-+*/.(]/.test(e.key))) {
      e.preventDefault();
      setText(e.key === "Enter" ? format(value, precision) : e.key);
      setEditing(true);
    }
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitText();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nudge(1, e);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nudge(-1, e);
    }
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
        <span className={cn("shrink-0 font-medium text-muted-foreground", compact ? "min-w-3 text-[11px]" : "min-w-3.5 text-[12px]")}>{prefix}</span>
      )}
      {editing ? (
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={onInputKeyDown}
          spellCheck={false}
          className={cn("min-w-0 flex-1 bg-transparent text-foreground outline-none tabular-nums", align === "right" && "text-right")}
        />
      ) : (
        <span className={cn("min-w-0 flex-1 truncate text-foreground", align === "right" && "text-right")}>{format(value, precision)}</span>
      )}
      {suffix && !editing && <span className="shrink-0 text-muted-foreground">{suffix}</span>}
    </div>
  );
});
