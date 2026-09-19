/**
 * Timeline shared inside the keyframes-effects step: tracks, clips, ruler,
 * draggable playhead, plus two slots variants fill — lanes under a track and
 * content inside a clip.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "#/lib/utils";
import { CLIPS, TRACKS, type Clip } from "#/prototypes/mock";
import { snapFrame, type Transport } from "./engine";

// ── Timeline ───────────────────────────────────────────────

export interface LaneCtx {
  side: "header" | "body";
  toX: (t: number) => number;
  pxPerSec: number;
}

export interface TimelineProps {
  transport: Transport;
  /** Visible window, seconds. */
  window?: [number, number];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Rendered under the track that owns the clip (Diamonds' property lanes). */
  renderUnderTrack?: (trackId: string, ctx: LaneCtx) => ReactNode;
  /** Rendered inside a clip body (keyframe ticks/rows). Receives px-per-second. */
  renderInClip?: (clip: Clip, pxPerSec: number) => ReactNode;
  trackHeight?: number;
  className?: string;
}

export function Timeline({
  transport,
  window: win = [22, 48],
  selectedId,
  onSelect,
  renderUnderTrack,
  renderInClip,
  trackHeight = 34,
  className,
}: TimelineProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [w0, w1] = win;
  const pxPerSec = width / (w1 - w0);
  const toX = (t: number) => (t - w0) * pxPerSec;

  const scrub = useCallback(
    (e: ReactPointerEvent) => {
      const el = areaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const move = (ev: PointerEvent) => {
        const t = w0 + ((ev.clientX - rect.left) / rect.width) * (w1 - w0);
        transport.seek(snapFrame(t));
      };
      move(e.nativeEvent);
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [transport, w0, w1],
  );

  const ticks: number[] = [];
  for (let t = Math.ceil(w0); t <= w1; t += 1) ticks.push(t);

  return (
    <div className={cn("flex select-none", className)}>
      <div className="w-32 shrink-0 border-r border-border">
        <div className="h-6 border-b border-border" />
        {TRACKS.map((tr) => (
          <div key={tr.id}>
            <div
              className="flex items-center gap-2 border-b border-border/60 px-2 text-[11px] text-muted-foreground"
              style={{ height: trackHeight }}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", tr.kind === "audio" ? "bg-emerald-400/70" : tr.kind === "text" ? "bg-amber-300/70" : tr.kind === "effect" ? "bg-slate-400/70" : "bg-sky-400/70")} />
              {tr.name}
            </div>
            {renderUnderTrack?.(tr.id, { side: "header", toX, pxPerSec })}
          </div>
        ))}
      </div>
      <div ref={areaRef} className="relative min-w-0 flex-1 overflow-hidden">
        <div className="relative h-6 cursor-ew-resize border-b border-border" onPointerDown={scrub}>
          {ticks.map((t) => (
            <div key={t} className="absolute top-0 h-full" style={{ left: toX(t) }}>
              <div className={cn("h-1.5 w-px bg-border", t % 5 === 0 && "h-2.5")} />
              {t % 5 === 0 && (
                <span className="absolute left-1 top-1 text-[10px] tabular-nums text-muted-foreground">{t}s</span>
              )}
            </div>
          ))}
        </div>
        {TRACKS.map((tr) => (
          <div key={tr.id}>
            <div className="relative border-b border-border/60" style={{ height: trackHeight }} onPointerDown={() => onSelect(null)}>
              {CLIPS.filter((c) => c.trackId === tr.id && c.start < w1 && c.start + c.duration > w0).map((c) => {
                const sel = c.id === selectedId;
                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelect(c.id);
                    }}
                    className={cn(
                      "absolute inset-y-1 overflow-hidden rounded-md border text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-foreground/50",
                      sel ? "border-foreground/80 ring-1 ring-foreground/40" : "border-transparent hover:brightness-110",
                    )}
                    style={{
                      left: toX(c.start),
                      width: c.duration * pxPerSec,
                      background: tr.kind === "audio" ? `${c.tint}55` : `${c.tint}99`,
                    }}
                  >
                    <div className="truncate px-2 leading-[26px] text-white/90">{c.label}</div>
                    {tr.kind === "audio" && <Waveform tint={c.tint} />}
                    {renderInClip?.(c, pxPerSec)}
                  </div>
                );
              })}
            </div>
            {renderUnderTrack?.(tr.id, { side: "body", toX, pxPerSec })}
          </div>
        ))}
        {/* Playhead */}
        <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-400" style={{ left: toX(transport.time) }}>
          <div className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-red-400" />
        </div>
      </div>
    </div>
  );
}

function Waveform({ tint }: { tint: string }) {
  const bars = Array.from({ length: 60 }, (_, i) => 30 + 50 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37)));
  return (
    <div className="pointer-events-none absolute inset-x-1 bottom-1 flex h-2 items-end gap-px opacity-60">
      {bars.map((h, i) => (
        <span key={i} className="flex-1" style={{ height: `${h}%`, background: tint }} />
      ))}
    </div>
  );
}

