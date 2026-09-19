/**
 * UI shared inside the keyframes-effects step: editor frame, live preview
 * canvas, compact keyframe track, scrubbable number field. The timeline is
 * in ./timeline.tsx. Every variant composes these and adds its own surface.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Pause, Play, Repeat, SkipBack, StepBack, StepForward, Timer } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import { ASSETS, PROJECTS, timecode } from "#/prototypes/mock";
import {
  CHANNELS,
  HERO_BG,
  HERO_CLIP,
  formatValue,
  snapFrame,
  type Channel,
  type ChannelValues,
  type Keyframe,
  type Transport,
} from "./engine";

export const PROJECT = PROJECTS[0];
export { Timeline, type LaneCtx, type TimelineProps } from "./timeline";

// ── Editor frame ───────────────────────────────────────────

export function EditorFrame({
  preview,
  inspector,
  timeline,
  inspectorWidth = 320,
  className,
}: {
  preview: ReactNode;
  inspector: ReactNode;
  timeline: ReactNode;
  inspectorWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full w-full flex-col bg-surface-1 text-foreground text-[12px]", className)}>
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PROJECT.tint }} />
        <span className="truncate font-medium">{PROJECT.name}</span>
        <span className="text-muted-foreground">
          {PROJECT.width}×{PROJECT.height} · {PROJECT.fps}fps
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="compact">Share</Button>
          <Button variant="secondary" size="compact">Export</Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-48 shrink-0 flex-col gap-1 border-r border-border bg-surface-2 p-2 lg:flex">
          <div className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">Media</div>
          {ASSETS.slice(0, 9).map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover">
              <span className="h-5 w-8 shrink-0 rounded-sm opacity-70" style={{ background: a.tint }} />
              <span className="truncate text-[11px] text-muted-foreground">{a.name}</span>
            </div>
          ))}
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">{preview}</main>
        <aside
          className="flex shrink-0 flex-col overflow-hidden border-l border-border bg-surface-2"
          style={{ width: inspectorWidth }}
        >
          {inspector}
        </aside>
      </div>
      <section className="shrink-0 border-t border-border bg-surface-2">{timeline}</section>
    </div>
  );
}

// ── Preview canvas ─────────────────────────────────────────

export function PreviewCanvas({
  values,
  transport,
  overlay,
  className,
  filterOrder,
}: {
  values: ChannelValues;
  transport: Transport;
  overlay?: ReactNode;
  className?: string;
  /** Effect channels in stack order (top → bottom). Defaults to blur/brightness/contrast/saturation. */
  filterOrder?: Channel[];
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ w: 640, h: 360 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const cw = e.contentRect.width, ch = e.contentRect.height;
      const w = Math.max(160, Math.min(cw, (ch * 16) / 9, 880));
      setFit({ w, h: (w * 9) / 16 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = fit.w / PROJECT.width;

  const inClip = transport.time >= HERO_CLIP.start && transport.time < HERO_CLIP.start + HERO_CLIP.duration;
  const order = filterOrder ?? ["blur", "brightness", "contrast", "saturation"];
  const filter = order
    .map((ch) => {
      const v = values[ch];
      if (ch === "blur") return `blur(${(v * scale).toFixed(2)}px)`;
      if (ch === "brightness") return `brightness(${(1 + v / 100).toFixed(3)})`;
      if (ch === "contrast") return `contrast(${(v / 100).toFixed(3)})`;
      return `saturate(${(v / 100).toFixed(3)})`;
    })
    .join(" ");

  const cardStyle: CSSProperties = {
    width: PROJECT.width * 0.62 * scale,
    height: PROJECT.height * 0.62 * scale,
    transform: `translate(${values.x * scale}px, ${values.y * scale}px) scale(${values.scale / 100})`,
    opacity: Math.max(0, Math.min(1, values.opacity / 100)),
    filter,
    background: `linear-gradient(135deg, ${HERO_CLIP.tint}, ${HERO_CLIP.tint}88)`,
    borderRadius: 14 * scale,
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div
          className="relative overflow-hidden rounded-lg bg-black shadow-surface-3"
          style={{ width: fit.w, height: fit.h }}
        >
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse at 30% 40%, ${HERO_BG.tint}66, #0a0a0f 75%)` }}
          />
          <div className="absolute bottom-3 left-3 text-[10px] text-white/40">{HERO_BG.label}</div>
          {inClip && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col justify-end p-[4%] text-white shadow-2xl" style={cardStyle}>
                <div className="text-[0.6em] uppercase tracking-widest opacity-70" style={{ fontSize: 24 * scale }}>
                  Slide 01
                </div>
                <div className="font-semibold leading-tight" style={{ fontSize: 56 * scale }}>
                  훅(Hook)이 실행되는 순서
                </div>
                <div className="mt-[2%] opacity-80" style={{ fontSize: 28 * scale }}>
                  PreToolUse → Tool → PostToolUse
                </div>
              </div>
            </div>
          )}
          {overlay}
        </div>
      </div>
    </div>
  );
}

export function TransportBar({ transport, children }: { transport: Transport; children?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-t border-border px-3">
      <Tooltip content="Go to clip start">
        <Button variant="ghost" size="icon-compact" aria-label="Go to clip start" onClick={() => transport.seekClip(0)}>
          <SkipBack />
        </Button>
      </Tooltip>
      <Button variant="ghost" size="icon-compact" aria-label="Previous frame" onClick={() => transport.stepFrame(-1)}>
        <StepBack />
      </Button>
      <Button
        variant="secondary"
        size="icon-compact"
        aria-label={transport.playing ? "Pause" : "Play"}
        onClick={transport.toggle}
      >
        {transport.playing ? <Pause /> : <Play />}
      </Button>
      <Button variant="ghost" size="icon-compact" aria-label="Next frame" onClick={() => transport.stepFrame(1)}>
        <StepForward />
      </Button>
      <span className="ml-2 font-medium tabular-nums">{timecode(transport.time, PROJECT.fps)}</span>
      <span className="text-muted-foreground tabular-nums">/ {timecode(HERO_CLIP.start + HERO_CLIP.duration, PROJECT.fps)}</span>
      <Tooltip content={transport.loopClip ? "Looping the selected clip" : "Play whole project"}>
        <Button
          variant="ghost"
          size="icon-compact"
          aria-label="Loop clip"
          active={transport.loopClip}
          onClick={() => transport.setLoopClip(!transport.loopClip)}
          className={transport.loopClip ? "text-foreground" : undefined}
        >
          <Repeat />
        </Button>
      </Tooltip>
      <span className="ml-1 text-muted-foreground">Space to play</span>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

// ── Keyframe glyphs & compact track ────────────────────────

export function Diamond({
  size = 10,
  color,
  selected,
  hollow,
  className,
  style,
}: {
  size?: number;
  color?: string;
  selected?: boolean;
  hollow?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block rotate-45 rounded-[1px] border transition-transform duration-100", className)}
      style={{
        width: size,
        height: size,
        background: hollow ? "transparent" : color ?? "var(--foreground)",
        borderColor: selected ? "var(--foreground)" : color ?? "var(--foreground)",
        boxShadow: selected ? "0 0 0 2px var(--background), 0 0 0 3px var(--foreground)" : undefined,
        transform: `rotate(45deg) scale(${selected ? 1.15 : 1})`,
        ...style,
      }}
    />
  );
}

export function Stopwatch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <Tooltip content={on ? `Stop animating ${label}` : `Animate ${label}`}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={`Animate ${label}`}
        onClick={onToggle}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-sm outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-foreground/50",
          on ? "text-sky-300" : "text-muted-foreground/60",
        )}
      >
        <Timer size={13} strokeWidth={on ? 2.2 : 1.6} />
      </button>
    </Tooltip>
  );
}

export interface KeyframeTrackProps {
  keyframes: Keyframe[];
  duration: number;
  /** Clip-relative playhead. */
  playhead: number;
  color?: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, t: number) => void;
  onAdd?: (t: number) => void;
  onDelete?: (id: string) => void;
  onScrub?: (t: number) => void;
  height?: number;
  diamond?: number;
  className?: string;
}

/** Horizontal strip of draggable diamonds over [0, duration]. Double-click adds; Backspace deletes. */
export function KeyframeTrack({
  keyframes,
  duration,
  playhead,
  color,
  selectedId,
  onSelect,
  onMove,
  onAdd,
  onDelete,
  onScrub,
  height = 20,
  diamond = 9,
  className,
}: KeyframeTrackProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return snapFrame(Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration)));
  };
  const drag = (e: ReactPointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(id);
    (e.currentTarget as HTMLElement).focus();
    const move = (ev: PointerEvent) => onMove(id, tAt(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div
      ref={ref}
      data-kf
      className={cn("relative w-full cursor-crosshair", className)}
      style={{ height }}
      onPointerDown={(e) => {
        onSelect(null);
        if (onScrub) {
          const move = (ev: PointerEvent) => onScrub(tAt(ev.clientX));
          move(e.nativeEvent);
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }
      }}
      onDoubleClick={(e) => onAdd?.(tAt(e.clientX))}
    >
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <div className="pointer-events-none absolute inset-y-0 w-px bg-red-400/70" style={{ left: `${(playhead / duration) * 100}%` }} />
      {keyframes.map((k) => (
        <button
          key={k.id}
          type="button"
          data-kf
          aria-label={`Keyframe at ${k.t.toFixed(2)}s`}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm p-1 outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
          style={{ left: `${(k.t / duration) * 100}%` }}
          onPointerDown={(e) => drag(e, k.id)}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if ((e.key === "Backspace" || e.key === "Delete") && onDelete) {
              e.preventDefault();
              onDelete(k.id);
            }
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              onMove(k.id, snapFrame(k.t + (e.key === "ArrowLeft" ? -1 / 30 : 1 / 30)));
            }
          }}
        >
          <Diamond size={diamond} color={color} selected={k.id === selectedId} />
        </button>
      ))}
    </div>
  );
}

// ── Scrubbable number field ────────────────────────────────

export function NumberField({
  channel,
  value,
  onChange,
  animated,
  atKeyframe,
  className,
  width = 72,
}: {
  channel: Channel;
  value: number;
  onChange: (v: number) => void;
  animated?: boolean;
  /** Playhead currently sits on a keyframe of this channel. */
  atKeyframe?: boolean;
  className?: string;
  width?: number;
}) {
  const meta = CHANNELS[channel];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const startRef = useRef<{ x: number; v: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (editing) return;
    startRef.current = { x: e.clientX, v: value };
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let moved = false;
    const move = (ev: PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      const dx = ev.clientX - s.x;
      if (Math.abs(dx) > 2) moved = true;
      const range = meta.max - meta.min;
      onChange(Math.round((s.v + (dx / 200) * range * (ev.shiftKey ? 0.1 : 1)) / meta.step) * meta.step);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      if (!moved) {
        setDraft(meta.step < 1 ? value.toFixed(1) : String(Math.round(value)));
        setEditing(true);
      }
      startRef.current = null;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const commit = () => {
    const n = parseFloat(draft);
    if (!Number.isNaN(n)) onChange(n);
    setEditing(false);
  };

  return editing ? (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className={cn("h-6 rounded-md border border-foreground/40 bg-background px-1.5 text-right text-[11px] tabular-nums outline-none", className)}
      style={{ width }}
    />
  ) : (
    <button
      type="button"
      onPointerDown={onPointerDown}
      className={cn(
        "h-6 cursor-ew-resize rounded-md border px-1.5 text-right text-[11px] tabular-nums outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-foreground/50",
        animated ? (atKeyframe ? "border-sky-400/70 bg-sky-400/10 text-sky-200" : "border-sky-400/30 text-sky-200/90") : "border-border bg-surface-3",
        className,
      )}
      style={{ width }}
      title="Drag to scrub · click to type"
    >
      {formatValue(channel, value)}
    </button>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pb-1 pt-3 text-[11px] font-medium text-muted-foreground">
      <span>{children}</span>
      {right}
    </div>
  );
}
