import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { Button } from "#/components/ui/button";
import { Tooltip } from "#/components/ui/tooltip";
import { Kbd } from "#/components/ui/kbd";
import { cn } from "#/lib/utils";
import { ASSETS, PROJECTS, shortDuration, type Clip } from "#/prototypes/mock";
import { CANVAS_H, CANVAS_W, clamp, clipsAt, frameStyle } from "./playback";

// ---------------------------------------------------------------------------
// Icon button — Tooltip + shortcut chip on every icon control
// ---------------------------------------------------------------------------

interface IconButtonProps {
  icon: IconSvgElement;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  active?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  size?: "icon" | "icon-compact";
  variant?: "ghost" | "tertiary" | "secondary" | "primary";
  className?: string;
  disabled?: boolean;
}

export function IconButton({
  icon,
  label,
  shortcut,
  onClick,
  active,
  side = "top",
  size = "icon-compact",
  variant = "ghost",
  className,
  disabled,
}: IconButtonProps) {
  return (
    <Tooltip
      side={side}
      content={
        <span className="flex items-center gap-1.5">
          {label}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </span>
      }
    >
      <Button
        variant={variant}
        size={size}
        active={active}
        aria-pressed={active}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        <HugeiconsIcon icon={icon} size={size === "icon" ? 18 : 16} strokeWidth={1.5} />
      </Button>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Text overlay state (lifted so the inspector can mirror it)
// ---------------------------------------------------------------------------

export interface OverlayBox {
  /** Centre, fraction of canvas width/height. */
  x: number;
  y: number;
  /** Font size as a fraction of canvas height. */
  size: number;
}

export interface TextOverlayState {
  boxes: Record<string, OverlayBox>;
  selected: string | null;
  setBox: (id: string, box: OverlayBox) => void;
  select: (id: string | null) => void;
}

const DEFAULT_BOX: OverlayBox = { x: 0.5, y: 0.78, size: 0.075 };

export function useTextOverlay(): TextOverlayState {
  const [boxes, setBoxes] = useState<Record<string, OverlayBox>>({});
  const [selected, select] = useState<string | null>(null);
  const setBox = useCallback((id: string, box: OverlayBox) => {
    setBoxes((b) => ({ ...b, [id]: box }));
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { boxes, selected, setBox, select };
}

export const boxFor = (ov: TextOverlayState, id: string) => ov.boxes[id] ?? DEFAULT_BOX;

// ---------------------------------------------------------------------------
// Preview canvas — the 16:9 "video" with direct manipulation
// ---------------------------------------------------------------------------

interface PreviewCanvasProps {
  time: number;
  ov: TextOverlayState;
  /** "fit" or an absolute scale (1 = 100 %, one project pixel per CSS pixel). */
  zoom: "fit" | number;
  pan?: { x: number; y: number };
  safe?: boolean;
  grid?: boolean;
  /** Padding kept around the frame when fitting. */
  fitPadding?: number;
  onFit?: (fit: number) => void;
  /** Rendered above the frame, inside the container. */
  children?: ReactNode;
  className?: string;
  containerProps?: HTMLAttributes<HTMLDivElement>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** Disables text hit-testing (e.g. while the hand tool is active). */
  passive?: boolean;
}

export function PreviewCanvas({
  time,
  ov,
  zoom,
  pan,
  safe,
  grid,
  fitPadding = 24,
  onFit,
  children,
  className,
  containerProps,
  containerRef,
  passive,
}: PreviewCanvasProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = containerRef ?? localRef;
  const [fit, setFit] = useState(0.4);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const f = Math.max(
        0.05,
        Math.min((r.width - fitPadding * 2) / CANVAS_W, (r.height - fitPadding * 2) / CANVAS_H),
      );
      setFit(f);
      onFit?.(f);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitPadding]);

  const scale = zoom === "fit" ? fit : zoom;
  const w = CANVAS_W * scale;
  const h = CANVAS_H * scale;
  const px = pan?.x ?? 0;
  const py = pan?.y ?? 0;
  const { text } = clipsAt(time);

  return (
    <div
      ref={ref}
      {...containerProps}
      className={cn("relative min-h-0 min-w-0 flex-1 overflow-hidden bg-background", containerProps?.className, className)}
      onPointerDown={(e) => {
        containerProps?.onPointerDown?.(e);
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg) ov.select(null);
      }}
    >
      <div
        data-canvas-bg
        className="absolute rounded-[2px] shadow-surface-4 will-change-transform"
        style={{
          width: w,
          height: h,
          left: `calc(50% + ${px}px)`,
          top: `calc(50% + ${py}px)`,
          transform: "translate(-50%, -50%)",
          ...frameStyle(time),
        }}
      >
        {/* film grain-ish vignette */}
        <div
          data-canvas-bg
          className="pointer-events-none absolute inset-0 rounded-[2px]"
          style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,.45)" }}
        />
        {grid && <Grid />}
        {safe && <SafeAreas />}
        {text && <TextBox clip={text} ov={ov} scale={scale} passive={passive} />}
      </div>
      {children}
    </div>
  );
}

function Grid() {
  return (
    <svg data-canvas-bg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1920 1080" preserveAspectRatio="none">
      {[640, 1280].map((x) => (
        <line key={x} x1={x} y1={0} x2={x} y2={1080} stroke="white" strokeOpacity={0.35} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ))}
      {[360, 720].map((y) => (
        <line key={y} x1={0} y1={y} x2={1920} y2={y} stroke="white" strokeOpacity={0.35} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

function SafeAreas() {
  return (
    <svg data-canvas-bg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1920 1080" preserveAspectRatio="none">
      <rect x={96} y={54} width={1728} height={972} fill="none" stroke="white" strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <rect x={192} y={108} width={1536} height={864} fill="none" stroke="white" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
      <line x1={940} y1={540} x2={980} y2={540} stroke="white" strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={960} y1={520} x2={960} y2={560} stroke="white" strokeOpacity={0.6} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <text x={100} y={1016} fill="white" fillOpacity={0.6} fontSize={22} fontFamily="Inter Variable, sans-serif">
        Action safe 90%
      </text>
      <text x={196} y={962} fill="white" fillOpacity={0.6} fontSize={22} fontFamily="Inter Variable, sans-serif">
        Title safe 80%
      </text>
    </svg>
  );
}

interface TextBoxProps {
  clip: Clip;
  ov: TextOverlayState;
  scale: number;
  passive?: boolean;
}

function TextBox({ clip, ov, scale, passive }: TextBoxProps) {
  const box = boxFor(ov, clip.id);
  const selected = ov.selected === clip.id;
  const elRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "resize"; sx: number; sy: number; box: OverlayBox; dist: number } | null>(null);

  const centre = () => {
    const r = elRef.current?.getBoundingClientRect();
    return r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2 } : { cx: 0, cy: 0 };
  };

  const onDown = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    if (passive) return;
    e.stopPropagation();
    e.preventDefault();
    ov.select(clip.id);
    const { cx, cy } = centre();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, box, dist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") {
      const dx = (e.clientX - d.sx) / (CANVAS_W * scale);
      const dy = (e.clientY - d.sy) / (CANVAS_H * scale);
      ov.setBox(clip.id, { ...d.box, x: clamp(d.box.x + dx, 0.02, 0.98), y: clamp(d.box.y + dy, 0.03, 0.97) });
    } else {
      const { cx, cy } = centre();
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      ov.setBox(clip.id, { ...d.box, size: clamp(d.box.size * (dist / d.dist), 0.025, 0.3) });
    }
  };
  const onUp = () => {
    drag.current = null;
  };

  const handle = "absolute size-2.5 rounded-[2px] border border-foreground bg-background";
  return (
    <div
      ref={elRef}
      role="button"
      tabIndex={0}
      aria-label={`Text: ${clip.label}`}
      onPointerDown={onDown("move")}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onKeyDown={(e) => {
        if (e.key === "Enter") ov.select(clip.id);
      }}
      className={cn(
        "absolute select-none whitespace-nowrap px-[0.35em] py-[0.15em] font-semibold tracking-[-0.02em] text-white outline-none",
        passive ? "cursor-default" : "cursor-move",
        selected ? "ring-1 ring-foreground" : "hover:ring-1 hover:ring-white/50",
      )}
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        transform: "translate(-50%, -50%)",
        fontSize: box.size * CANVAS_H * scale,
        textShadow: "0 2px 12px rgba(0,0,0,.55)",
        lineHeight: 1.15,
      }}
    >
      {clip.label}
      {selected && (
        <>
          <div onPointerDown={onDown("resize")} onPointerMove={onMove} onPointerUp={onUp} className={cn(handle, "-left-1.5 -top-1.5 cursor-nwse-resize")} />
          <div onPointerDown={onDown("resize")} onPointerMove={onMove} onPointerUp={onUp} className={cn(handle, "-right-1.5 -top-1.5 cursor-nesw-resize")} />
          <div onPointerDown={onDown("resize")} onPointerMove={onMove} onPointerUp={onUp} className={cn(handle, "-bottom-1.5 -left-1.5 cursor-nesw-resize")} />
          <div onPointerDown={onDown("resize")} onPointerMove={onMove} onPointerUp={onUp} className={cn(handle, "-bottom-1.5 -right-1.5 cursor-nwse-resize")} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor frame — realistic chrome around the focal preview
// ---------------------------------------------------------------------------

interface EditorFrameProps {
  children: ReactNode;
  timeline: ReactNode;
  ov: TextOverlayState;
  time: number;
  /** Hide the side panels for canvas-maximising directions. */
  sidebars?: boolean;
  className?: string;
}

const project = PROJECTS[0];

export function EditorFrame({ children, timeline, ov, time, sidebars = true, className }: EditorFrameProps) {
  const { text } = clipsAt(time);
  const sel = ov.selected && text && text.id === ov.selected ? text : null;
  const box = sel ? boxFor(ov, sel.id) : null;

  return (
    <div className={cn("flex h-full w-full flex-col bg-surface-1 text-[13px] text-foreground", className)}>
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="size-2 rounded-full" style={{ background: project.tint }} />
        <span className="truncate font-medium">{project.name}</span>
        <span className="text-[11px] text-muted-foreground">
          {project.width}×{project.height} · {project.fps} fps
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">Saved 2분 전</span>
        <Button variant="secondary" size="compact">
          Export
        </Button>
      </header>
      <div className="flex min-h-0 flex-1">
        {sidebars && (
          <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-surface-2">
            <PanelTitle>Media</PanelTitle>
            <ul className="min-h-0 flex-1 overflow-hidden px-1.5">
              {ASSETS.slice(0, 9).map((a) => (
                <li key={a.id} className="flex h-7 items-center gap-2 rounded-md px-1.5 text-muted-foreground hover:bg-hover">
                  <span className="size-3.5 shrink-0 rounded-[3px]" style={{ background: a.tint }} />
                  <span className="truncate text-[12px]">{a.name}</span>
                  <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] tabular-nums">{a.duration ? shortDuration(a.duration) : "img"}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
        {sidebars && (
          <aside className="flex w-52 shrink-0 flex-col border-l border-border bg-surface-2">
            <PanelTitle>Inspector</PanelTitle>
            {sel && box ? (
              <div className="space-y-3 px-3 text-[12px]">
                <div className="truncate font-medium">{sel.label}</div>
                <Field label="Position" value={`${Math.round(box.x * CANVAS_W)}, ${Math.round(box.y * CANVAS_H)}`} />
                <Field label="Size" value={`${Math.round(box.size * CANVAS_H)} px`} />
                <Field label="Font" value="Pretendard Semibold" />
                <Field label="Opacity" value="100%" />
              </div>
            ) : (
              <div className="px-3 text-[12px] text-muted-foreground">Select a text layer on the canvas to edit it.</div>
            )}
          </aside>
        )}
      </div>
      <footer className="shrink-0 border-t border-border bg-surface-2">{timeline}</footer>
    </div>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <div className="flex h-8 shrink-0 items-center px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="rounded-md bg-surface-3 px-2 py-1 tabular-nums">{value}</span>
    </div>
  );
}

/** Translucent chrome used for floating controls. */
export const glass: CSSProperties = {
  backdropFilter: "blur(14px) saturate(1.2)",
  WebkitBackdropFilter: "blur(14px) saturate(1.2)",
};
