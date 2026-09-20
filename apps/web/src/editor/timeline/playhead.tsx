/**
 * Leaves driven by the TimeStore. They subscribe and write to the DOM, so
 * the playhead can move 60×/s without re-rendering a single clip.
 */
import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { timecode, useEditor, useEditorContext } from "#/editor/core";
import { cn } from "#/lib/utils";
import type { Viewport } from "./engine";
import { HEADER_W } from "./geometry";

/** Timecode readout bound to the playhead. */
export function TimeReadout({ className }: { className?: string }) {
  const { time } = useEditorContext();
  const fps = useEditor((s) => s.doc.project.fps);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      time.subscribe((t) => {
        if (ref.current) ref.current.textContent = timecode(t, fps);
      }),
    [time, fps],
  );
  return <span ref={ref} className={cn("tabular-nums", className)} />;
}

/**
 * Playhead overlay. It lives outside the scroll container so the sticky
 * track headers never fight it, and re-positions on ticks and on scroll.
 */
export function Playhead({ view, onScrub }: { view: Viewport; onScrub: (e: ReactPointerEvent) => void }) {
  const { time } = useEditorContext();
  const { scrollRef, pps } = view;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    const apply = () => {
      const node = ref.current;
      if (!node || !el) return;
      const x = time.get() * pps - el.scrollLeft;
      node.style.transform = `translate3d(${HEADER_W + x}px,0,0)`;
      node.style.visibility = x < -1 || x > el.clientWidth - HEADER_W ? "hidden" : "visible";
    };
    const unsub = time.subscribe(apply);
    el?.addEventListener("scroll", apply, { passive: true });
    return () => {
      unsub();
      el?.removeEventListener("scroll", apply);
    };
  }, [time, scrollRef, pps]);

  return (
    <div ref={ref} data-testid="playhead" className="pointer-events-none absolute inset-y-0 left-0 z-40 w-0 will-change-transform">
      <div className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-destructive" />
      <div
        className="pointer-events-auto absolute left-0 top-0 -translate-x-1/2 cursor-ew-resize"
        onPointerDown={onScrub}
        aria-label="재생 헤드"
      >
        <div className="mt-[14px] h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-destructive" />
      </div>
    </div>
  );
}

/** Guide line shown while a drag is snapped to something. */
export function SnapLine({ at, pps }: { at: number | null; pps: number }) {
  if (at === null) return null;
  return <div className="pointer-events-none absolute inset-y-0 z-30 w-px bg-focus-ring" style={{ left: at * pps }} />;
}
