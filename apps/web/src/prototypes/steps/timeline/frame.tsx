import { useEffect, useRef, type ReactNode } from "react";
import { timecode } from "#/prototypes/mock";
import { FPS, PROJECT, type Engine } from "./shared";

/* ------------------------------------------------------------------ */
/* Surrounding editor frame: dim preview + inspector above the timeline */
/* ------------------------------------------------------------------ */

function PreviewCanvas({ engine }: { engine: Engine }) {
  const ref = useRef<HTMLDivElement>(null);
  const { store, clips } = engine;
  useEffect(
    () =>
      store.subscribe((t) => {
        const node = ref.current;
        if (!node) return;
        const top = clips.find((c) => c.trackId === "t-v2" && t >= c.start && t < c.start + c.duration);
        const base = clips.find((c) => c.trackId === "t-v1" && t >= c.start && t < c.start + c.duration);
        const tint = (top ?? base)?.tint ?? "transparent";
        node.style.background = `radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, ${tint} 70%, white 6%), color-mix(in srgb, ${tint} 55%, black) 70%)`;
      }),
    [store, clips],
  );
  return (
    <div className="relative flex h-full items-center justify-center p-4">
      <div ref={ref} className="relative aspect-video max-h-full w-auto max-w-full rounded-md shadow-surface-4" style={{ height: "100%" }}>
        <div className="absolute inset-x-6 bottom-5 flex items-end justify-between text-[11px] text-white/70">
          <span className="rounded bg-black/30 px-1.5 py-0.5 font-medium backdrop-blur-sm">훅(Hook)이란 무엇인가</span>
          <span className="rounded bg-black/30 px-1.5 py-0.5 tabular-nums backdrop-blur-sm">1920×1080 · 30fps</span>
        </div>
      </div>
    </div>
  );
}

function Inspector({ engine }: { engine: Engine }) {
  const sel = engine.clips.filter((c) => engine.selected.has(c.id));
  const one = sel.length === 1 ? sel[0] : null;
  const row = (k: string, v: string) => (
    <div key={k} className="flex items-center justify-between py-1.5 text-[12px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular-nums text-foreground/90">{v}</span>
    </div>
  );
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-l border-border bg-surface-2">
      <div className="flex h-9 items-center border-b border-border px-3 text-[12px] font-medium text-muted-foreground">Inspector</div>
      <div className="flex-1 overflow-auto px-3 py-2">
        {one ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: one.tint }} />
              <span className="truncate text-[13px] font-medium">{one.label}</span>
            </div>
            {row("Start", timecode(one.start, FPS))}
            {row("Duration", timecode(one.duration, FPS))}
            {row("In point", timecode(one.inPoint, FPS))}
            {row("Track", engine.tracks.find((t) => t.id === one.trackId)?.name ?? "")}
            <div className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">Transform · Opacity · Blend are edited in the Inspector step.</div>
          </>
        ) : sel.length > 1 ? (
          <div className="text-[12px] text-muted-foreground">{sel.length} clips selected</div>
        ) : (
          <div className="text-[12px] text-muted-foreground">Select a clip to see its properties.</div>
        )}
      </div>
    </aside>
  );
}

export function EditorFrame({ engine, timelineHeight, children }: { engine: Engine; timelineHeight: string; children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3 text-[12px]">
        <span className="font-medium">{PROJECT.name}</span>
        <span className="text-muted-foreground">
          {PROJECT.width}×{PROJECT.height} · {PROJECT.fps} fps
        </span>
        <span className="ml-auto rounded-md bg-surface-4 px-2 py-1 text-muted-foreground">Autosaved 2m ago</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 bg-surface-1">
          <PreviewCanvas engine={engine} />
        </div>
        <Inspector engine={engine} />
      </div>
      <div className="relative shrink-0 border-t border-border" style={{ height: timelineHeight }}>
        {children}
      </div>
    </div>
  );
}
