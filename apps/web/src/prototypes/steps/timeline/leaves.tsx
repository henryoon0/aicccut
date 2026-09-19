import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { timecode } from "#/prototypes/mock";
import { FPS, clamp, mulberry, shortTime, tcFrames, type Engine, type TimeStore } from "./shared";

/* ------------------------------------------------------------------ */
/* Store-driven leaves (write to DOM, never re-render parents)          */
/* ------------------------------------------------------------------ */

/** Timecode readout bound to the store. */
export function Timecode({ store, className, format = "full" }: { store: TimeStore; className?: string; format?: "full" | "short" | "frames" }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      store.subscribe((t) => {
        if (!ref.current) return;
        ref.current.textContent = format === "full" ? timecode(t, FPS) : format === "frames" ? tcFrames(t) : shortTime(t);
      }),
    [store, format],
  );
  return <span ref={ref} className={`tabular-nums ${className ?? ""}`} />;
}

/**
 * Playhead overlay. Lives outside the scroll container so sticky headers
 * never fight it; it re-positions on store ticks and on scroll.
 */
export function Playhead({
  engine,
  headerW,
  children,
  className,
  lineClassName,
}: {
  engine: Engine;
  headerW: number;
  /** Rendered at the top of the line (a flag / triangle). Gets the scrub handler. */
  children?: ReactNode;
  className?: string;
  lineClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { store, scrollRef, pps } = engine;
  useEffect(() => {
    const el = scrollRef.current;
    const apply = () => {
      const node = ref.current;
      if (!node || !el) return;
      const x = store.get() * pps - el.scrollLeft;
      node.style.transform = `translate3d(${headerW + x}px,0,0)`;
      node.style.visibility = x < -1 || x > el.clientWidth - headerW ? "hidden" : "visible";
    };
    const unsub = store.subscribe(apply);
    el?.addEventListener("scroll", apply, { passive: true });
    return () => {
      unsub();
      el?.removeEventListener("scroll", apply);
    };
  }, [store, scrollRef, pps, headerW]);
  return (
    <div ref={ref} className={`pointer-events-none absolute inset-y-0 left-0 z-40 w-0 will-change-transform ${className ?? ""}`}>
      <div className={`absolute inset-y-0 left-0 -translate-x-1/2 ${lineClassName ?? "w-px bg-foreground"}`} />
      <div className="pointer-events-auto absolute left-0 top-0 -translate-x-1/2 cursor-ew-resize" onPointerDown={engine.onScrubPointerDown}>
        {children}
      </div>
    </div>
  );
}

/** Snap guide line, in content coordinates. */
export function SnapLine({ engine, className }: { engine: Engine; className?: string }) {
  if (engine.snapLine === null) return null;
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-30 w-px ${className ?? "bg-focus-ring"}`}
      style={{ left: engine.snapLine * engine.pps }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Clip content fakes                                                  */
/* ------------------------------------------------------------------ */

export function filmstripStyle(tint: string, frameW: number): CSSProperties {
  const half = frameW / 2;
  return {
    backgroundColor: tint,
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0) 45%, rgba(0,0,0,.28)), repeating-linear-gradient(90deg, color-mix(in srgb, ${tint} 78%, black) 0 ${half}px, color-mix(in srgb, ${tint} 88%, white) ${half}px ${frameW - 1}px, rgba(0,0,0,.45) ${frameW - 1}px ${frameW}px)`,
  };
}

export function Waveform({ seed, seconds, color, className, density = 6 }: { seed: number; seconds: number; color: string; className?: string; density?: number }) {
  const bars = useMemo(() => {
    const n = Math.min(900, Math.max(8, Math.round(seconds * density)));
    const rnd = mulberry(seed);
    const out: number[] = [];
    let env = 0.5;
    for (let i = 0; i < n; i++) {
      env += (rnd() - 0.5) * 0.35;
      env = clamp(env, 0.15, 1);
      out.push(clamp(env * (0.55 + rnd() * 0.6), 0.06, 1));
    }
    return out;
  }, [seed, seconds, density]);
  return (
    <svg viewBox={`0 0 ${bars.length} 100`} preserveAspectRatio="none" className={`h-full w-full ${className ?? ""}`} aria-hidden>
      {bars.map((h, i) => (
        <rect key={i} x={i + 0.15} width={0.7} y={50 - h * 46} height={h * 92} fill={color} />
      ))}
    </svg>
  );
}

