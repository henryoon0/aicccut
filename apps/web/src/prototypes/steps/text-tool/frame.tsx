import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Pause, Play, SkipBack, SkipForward, Type } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import { CLIPS, PROJECTS, PROJECT_DURATION, TRACKS, timecode } from "#/prototypes/mock";
import { textCss, type TextStyle } from "./shared";

const PROJECT = PROJECTS[0];
export const TEXT_CLIP = CLIPS.find((c) => c.id === "c10")!;

// ── Editor frame: header, optional side panels, canvas, timeline ──

interface EditorFrameProps {
  children: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  /** Sits between the header and the canvas (toolbars). */
  above?: ReactNode;
  /** Sits between the canvas and the timeline. */
  below?: ReactNode;
  className?: string;
}

export function EditorFrame({ children, left, right, above, below, className }: EditorFrameProps) {
  return (
    <div className={cn("flex h-full w-full flex-col bg-surface-1 text-foreground", className)}>
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-muted-foreground">Projects</span>
          <span className="text-muted-foreground">/</span>
          <span className="truncate font-medium">{PROJECT.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-surface-3 px-2 py-1 text-[11px] text-muted-foreground tabular-nums">{PROJECT.width} × {PROJECT.height} · {PROJECT.fps} fps</span>
          <Button size="compact" variant="secondary">Export</Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        {left}
        <div className="flex min-w-0 flex-1 flex-col">
          {above}
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">{children}</div>
          {below}
          <Transport />
        </div>
        {right}
      </div>
      <TimelineStrip />
    </div>
  );
}

function Transport() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="flex h-9 shrink-0 items-center justify-center gap-1 border-t border-border">
      <Button size="icon-compact" variant="ghost" aria-label="Go to start"><SkipBack /></Button>
      <Button size="icon-compact" variant="ghost" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button size="icon-compact" variant="ghost" aria-label="Go to end"><SkipForward /></Button>
      <span className="ml-3 text-[11px] text-muted-foreground tabular-nums">{timecode(TEXT_CLIP.start + 1.6)} / {timecode(PROJECT_DURATION)}</span>
    </div>
  );
}

// ── Dim timeline strip with the text clip selected ────────

export function TimelineStrip() {
  const px = (s: number) => `${(s / PROJECT_DURATION) * 100}%`;
  return (
    <div className="h-[132px] shrink-0 border-t border-border bg-surface-2">
      <div className="flex h-6 items-end border-b border-border pl-24 text-[10px] text-muted-foreground tabular-nums">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="relative flex-1 border-l border-border pb-0.5 pl-1">{timecode(i * (PROJECT_DURATION / 10)).slice(3, 8)}</span>
        ))}
      </div>
      <div className="relative">
        {TRACKS.map((t) => (
          <div key={t.id} className="flex h-[17px] items-stretch border-b border-border/60">
            <div className={cn("w-24 shrink-0 truncate px-2 text-[10px] leading-[17px]", t.kind === "text" ? "text-foreground" : "text-muted-foreground")}>{t.name}</div>
            <div className="relative flex-1">
              {CLIPS.filter((c) => c.trackId === t.id).map((c) => (
                <div
                  key={c.id}
                  className={cn("absolute inset-y-[2px] truncate rounded-[3px] px-1 text-[9px] leading-[13px]", c.id === TEXT_CLIP.id ? "text-[#1a1a1a] ring-2 ring-foreground" : "text-white/70 opacity-40")}
                  style={{ left: px(c.start), width: px(c.duration), background: c.tint }}
                >
                  {c.id === TEXT_CLIP.id && <Type size={9} className="mr-0.5 inline -mt-px" />}{c.label}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-foreground" style={{ left: `calc(6rem + ${px(TEXT_CLIP.start + 1.6)})` }} />
      </div>
    </div>
  );
}

// ── Canvas: 16:9 box that reports its scale ───────────────

interface CanvasProps {
  children: (scale: number, ref: RefObject<HTMLDivElement | null>) => ReactNode;
  className?: string;
  onBackgroundClick?: () => void;
  onDoubleClick?: () => void;
  /** Extra layer rendered above the content at canvas coordinates. */
  overlay?: ReactNode;
}

export function Canvas({ children, className, onBackgroundClick, onDoubleClick, overlay }: CanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PROJECT.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cn("relative aspect-video max-h-full w-full max-w-full overflow-hidden rounded-lg bg-[#0b0b10] shadow-surface-3", className)}
      style={{ backgroundImage: "radial-gradient(120% 90% at 50% 110%, #2b2f6e 0%, #141631 45%, #0b0b10 100%)" }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onBackgroundClick?.(); }}
      onDoubleClick={(e) => { if (e.target === e.currentTarget) onDoubleClick?.(); }}
    >
      {/* Ambient screen recording stand-in */}
      <div className="pointer-events-none absolute inset-x-[8%] bottom-[-6%] top-[22%] rounded-md border border-white/10 bg-white/[0.03]" />
      <div className="pointer-events-none absolute left-[8%] top-[22%] flex h-[4%] w-[84%] items-center gap-[0.6%] rounded-t-md border-b border-white/10 bg-white/[0.04] px-[1%]">
        <span className="h-[45%] aspect-square rounded-full bg-white/15" /><span className="h-[45%] aspect-square rounded-full bg-white/15" /><span className="h-[45%] aspect-square rounded-full bg-white/15" />
      </div>
      {children(scale, ref)}
      {overlay}
    </div>
  );
}

// ── Text element on the canvas ────────────────────────────

interface TextElementProps {
  text: TextStyle;
  scale: number;
  canvasRef: RefObject<HTMLDivElement | null>;
  selected: boolean;
  editing?: boolean;
  onSelect: () => void;
  onMove?: (x: number, y: number) => void;
  onStartEdit?: () => void;
  onEdit?: (content: string) => void;
  onEndEdit?: () => void;
  /** Called with the element's rect (canvas-relative, px) after layout. */
  onLayout?: (rect: Rect) => void;
  showHandles?: boolean;
}

export function TextElement({ text, scale, canvasRef, selected, editing = false, onSelect, onMove, onStartEdit, onEdit, onEndEdit, onLayout, showHandles = true }: TextElementProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number; moved: boolean } | null>(null);

  // Keep contentEditable's DOM text in sync only while not editing, so the
  // caret never jumps mid-typing.
  useEffect(() => {
    const el = editRef.current;
    if (el && !editing && el.textContent !== text.content) el.textContent = text.content;
  }, [text.content, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  useLayoutEffect(() => {
    if (!onLayout) return;
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const report = () => {
      const b = box.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      onLayout({ left: b.left - c.left, top: b.top - c.top, width: b.width, height: b.height, canvasWidth: c.width, canvasHeight: c.height });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(box);
    return () => ro.disconnect();
  }, [onLayout, text, scale, canvasRef, selected, editing]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing) return;
    e.stopPropagation();
    onSelect();
    if (!onMove) return;
    drag.current = { startX: e.clientX, startY: e.clientY, ox: text.x, oy: text.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const c = canvasRef.current;
    if (!d || !c || !onMove) return;
    const r = c.getBoundingClientRect();
    const dx = ((e.clientX - d.startX) / r.width) * 100;
    const dy = ((e.clientY - d.startY) / r.height) * 100;
    if (Math.abs(dx) + Math.abs(dy) > 0.3) d.moved = true;
    if (d.moved) onMove(Math.min(95, Math.max(5, d.ox + dx)), Math.min(95, Math.max(5, d.oy + dy)));
  };

  return (
    <div
      ref={boxRef}
      className={cn("absolute max-w-[92%] -translate-x-1/2 -translate-y-1/2 select-none whitespace-pre-wrap px-[0.15em] py-[0.05em] outline-none", !editing && onMove && "cursor-move")}
      style={{ left: `${text.x}%`, top: `${text.y}%`, ...textCss(text, scale) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onDoubleClick={(e) => { e.stopPropagation(); onStartEdit?.(); }}
    >
      <div
        ref={editRef}
        contentEditable={editing}
        suppressContentEditableWarning
        spellCheck={false}
        className={cn("outline-none", editing && "cursor-text select-text")}
        onInput={(e) => onEdit?.(e.currentTarget.textContent ?? "")}
        onBlur={() => editing && onEndEdit?.()}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onEndEdit?.(); }
        }}
      />
      {(selected || editing) && showHandles && (
        <div className={cn("pointer-events-none absolute -inset-1 rounded-sm ring-1", editing ? "ring-[#6B97FF]" : "ring-white/80")}>
          {!editing && ["-left-1 -top-1", "-right-1 -top-1", "-left-1 -bottom-1", "-right-1 -bottom-1"].map((pos) => (
            <span key={pos} className={cn("absolute h-2 w-2 rounded-[2px] bg-white ring-1 ring-black/40", pos)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Where the scaled text lands for a floating toolbar to anchor to. */
export type Rect = { left: number; top: number; width: number; height: number; canvasWidth: number; canvasHeight: number };
