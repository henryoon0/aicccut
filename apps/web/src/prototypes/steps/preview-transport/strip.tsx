import { useRef } from "react";
import { cn } from "#/lib/utils";
import { CLIPS, PROJECT_DURATION, TRACKS } from "#/prototypes/mock";
import { clamp } from "./playback";

interface TimelineStripProps {
  time: number;
  onSeek: (t: number) => void;
  /** Called on pointer-down so the variant can pause during a scrub. */
  onScrubStart?: () => void;
  inPoint?: number | null;
  outPoint?: number | null;
  bookmarks?: number[];
  /** Row height per track, px. */
  rowHeight?: number;
  className?: string;
}

const HEADER_W = 76;
const RULER_H = 18;

/** Slim TRACKS/CLIPS strip whose playhead follows the clock; click/drag scrubs. */
export function TimelineStrip({
  time,
  onSeek,
  onScrubStart,
  inPoint,
  outPoint,
  bookmarks = [],
  rowHeight = 16,
  className,
}: TimelineStripProps) {
  const lane = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(t / PROJECT_DURATION) * 100}%`;

  const seekFromEvent = (e: React.PointerEvent) => {
    const r = lane.current?.getBoundingClientRect();
    if (!r) return;
    onSeek(clamp(((e.clientX - r.left) / r.width) * PROJECT_DURATION, 0, PROJECT_DURATION));
  };

  const ticks: number[] = [];
  for (let t = 0; t <= PROJECT_DURATION; t += 10) ticks.push(t);

  return (
    <div className={cn("flex select-none text-[10px]", className)} style={{ height: RULER_H + TRACKS.length * rowHeight + 8 }}>
      <div className="shrink-0 border-r border-border" style={{ width: HEADER_W }}>
        <div style={{ height: RULER_H }} />
        {TRACKS.map((t) => (
          <div
            key={t.id}
            className={cn("flex items-center truncate px-2 text-muted-foreground", t.kind === "audio" && "text-emerald-600 dark:text-emerald-400/80")}
            style={{ height: rowHeight }}
          >
            {t.name}
          </div>
        ))}
      </div>
      <div
        ref={lane}
        className="relative min-w-0 flex-1 cursor-ew-resize touch-none"
        onPointerDown={(e) => {
          onScrubStart?.();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          seekFromEvent(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) seekFromEvent(e);
        }}
      >
        {/* in/out range */}
        {(inPoint != null || outPoint != null) && (
          <div
            className="pointer-events-none absolute inset-y-0 bg-selected/60"
            style={{ left: pct(inPoint ?? 0), width: pct((outPoint ?? PROJECT_DURATION) - (inPoint ?? 0)) }}
          />
        )}
        {/* ruler */}
        <div className="relative border-b border-border text-muted-foreground" style={{ height: RULER_H }}>
          {ticks.map((t) => (
            <div key={t} className="absolute top-0 flex h-full flex-col justify-end" style={{ left: pct(t) }}>
              <span className="mb-0.5 -translate-x-1/2 tabular-nums">{t === 0 ? "0" : `${t}s`}</span>
              <span className="h-1 w-px bg-border" />
            </div>
          ))}
          {bookmarks.map((b) => (
            <span key={b} className="absolute bottom-0 size-1.5 -translate-x-1/2 rotate-45 rounded-[1px] bg-amber-500" style={{ left: pct(b) }} />
          ))}
          {inPoint != null && <Marker t={inPoint} label="I" pct={pct} />}
          {outPoint != null && <Marker t={outPoint} label="O" pct={pct} />}
        </div>
        {/* tracks */}
        {TRACKS.map((track) => (
          <div key={track.id} className="relative border-b border-border/50" style={{ height: rowHeight }}>
            {CLIPS.filter((c) => c.trackId === track.id).map((c) => (
              <div
                key={c.id}
                className="absolute inset-y-[2px] overflow-hidden rounded-[3px] px-1 leading-none text-white/90"
                style={{ left: pct(c.start), width: pct(c.duration), background: c.tint, opacity: 0.85 }}
              >
                <span className="block truncate" style={{ lineHeight: `${rowHeight - 4}px` }}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        ))}
        {/* playhead */}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-foreground" style={{ left: pct(time) }}>
          <span className="absolute -left-[4px] top-0 size-0 border-x-[4.5px] border-t-[6px] border-x-transparent border-t-foreground" />
        </div>
      </div>
    </div>
  );
}

function Marker({ t, label, pct }: { t: number; label: string; pct: (t: number) => string }) {
  return (
    <span
      className="absolute bottom-0 flex h-3 -translate-x-1/2 items-center rounded-[2px] bg-foreground px-1 text-[9px] font-semibold text-background"
      style={{ left: pct(t) }}
    >
      {label}
    </span>
  );
}
