import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Clapperboard, Film, Music, Pause, Play, Sparkles, Type as TypeIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import { CLIPS, PROJECTS, PROJECT_DURATION, TRACKS, timecode } from "#/prototypes/mock";
import { SELECTED_CLIP, type ElementProps } from "./shared";

const PROJECT = PROJECTS[0];
const PLAYHEAD = 4.2;

/** Whole editor: header, media rail, preview + timeline, and the inspector slot on the right. */
export function EditorFrame({
  element,
  panelWidth,
  children,
}: {
  element: ElementProps;
  panelWidth: number;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="inline-flex items-center gap-2 select-none">
          <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-foreground text-background">
            <span className="block size-2 rounded-[1px] border-[1.5px] border-current" />
          </span>
          <span className="text-[13px] font-semibold tracking-[-0.01em]">OpenCut</span>
        </span>
        <span className="text-muted-foreground/60">/</span>
        <span className="truncate text-[13px] text-muted-foreground">{PROJECT.name}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="compact">Share</Button>
          <Button variant="secondary" size="compact">Export</Button>
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <MediaRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <PreviewCanvas element={element} />
          <TimelineStrip />
        </div>
        <aside
          className="flex shrink-0 flex-col border-l border-border bg-surface-2"
          style={{ width: panelWidth }}
        >
          {children}
        </aside>
      </div>
    </div>
  );
}

function MediaRail() {
  const items = [
    { icon: Film, label: "Media", active: false },
    { icon: TypeIcon, label: "Text", active: true },
    { icon: Sparkles, label: "Effects", active: false },
    { icon: Music, label: "Audio", active: false },
  ];
  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-2">
      {items.map(({ icon: Icon, label, active }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          className={cn(
            "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors duration-80 hover:bg-hover hover:text-foreground",
            active && "bg-selected/40 text-foreground",
          )}
        >
          <Icon size={16} strokeWidth={1.5} />
        </button>
      ))}
    </nav>
  );
}

// ── Preview ──────────────────────────────────────────────

function PreviewCanvas({ element }: { element: ElementProps }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.4);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setK(entry.contentRect.width / PROJECT.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const textStyle: CSSProperties = {
    left: "50%",
    top: "50%",
    transform: `translate(-50%, -50%) translate(${element.x * k}px, ${element.y * k}px) rotate(${element.rotation}deg) scale(${element.scale / 100})`,
    opacity: element.opacity / 100,
    mixBlendMode: element.blend.toLowerCase().replace(" ", "-") as CSSProperties["mixBlendMode"],
    fontFamily: `"${element.font}", "Pretendard", "Inter", sans-serif`,
    fontSize: element.fontSize * k,
    fontWeight: element.weight,
    letterSpacing: element.letterSpacing * k,
    lineHeight: element.lineHeight,
    color: element.color,
    padding: element.fillEnabled ? `${element.fillPadding * k * 0.6}px ${element.fillPadding * k}px` : 0,
    borderRadius: element.fillEnabled ? element.fillRadius * k : 0,
    background: element.fillEnabled ? element.fill : "transparent",
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center p-5">
        <div
          ref={ref}
          className="relative aspect-video max-h-full w-full max-w-full overflow-hidden rounded-lg shadow-surface-3"
          style={{
            background: "radial-gradient(120% 90% at 20% 15%, #3a86ff 0%, #1d3a8a 45%, #0a0f1f 100%)",
          }}
        >
          {/* faux camera footage: desk, keyboard, monitor glow */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/70 to-transparent" />
          <div aria-hidden className="absolute left-[8%] top-[18%] h-[46%] w-[34%] rounded-[6px] bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
          <div aria-hidden className="absolute left-[10%] top-[21%] h-[40%] w-[30%] rounded-[4px] bg-gradient-to-br from-[#7209b7]/60 to-[#3a86ff]/30" />
          <div aria-hidden className="absolute right-[10%] top-[24%] size-[28%] rounded-full bg-[#ffd166]/25 blur-2xl" />
          <div aria-hidden className="absolute bottom-[10%] left-[12%] h-[3%] w-[52%] rounded-full bg-white/10" />

          <div className="absolute whitespace-nowrap will-change-transform" style={textStyle}>
            {SELECTED_CLIP.label}
            {/* selection outline stays upright with the element */}
            <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-[3px] ring-1 ring-[#6B97FF]" />
            {["-left-1 -top-1", "-right-1 -top-1", "-left-1 -bottom-1", "-right-1 -bottom-1"].map((pos) => (
              <span key={pos} aria-hidden className={cn("pointer-events-none absolute size-1.5 rounded-[1px] bg-white ring-1 ring-[#6B97FF]", pos)} />
            ))}
          </div>

          <span className="absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] tabular-nums text-white/70 backdrop-blur-sm">
            {PROJECT.width} × {PROJECT.height} · {PROJECT.fps} fps
          </span>
        </div>
      </div>
      <div className="flex h-9 shrink-0 items-center gap-2 border-t border-border px-3">
        <Button
          variant="ghost"
          size="icon-compact"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </Button>
        <span className="text-[12px] tabular-nums text-foreground">{timecode(PLAYHEAD, PROJECT.fps)}</span>
        <span className="text-[12px] tabular-nums text-muted-foreground">/ {timecode(PROJECT_DURATION, PROJECT.fps)}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">Fit · 42%</span>
      </div>
    </section>
  );
}

// ── Timeline (quiet neighbour) ───────────────────────────

const TRACK_ICON = { video: Clapperboard, audio: Music, text: TypeIcon, effect: Sparkles } as const;

function TimelineStrip() {
  const pct = (s: number) => `${(s / PROJECT_DURATION) * 100}%`;
  return (
    <section className="h-[168px] shrink-0 border-t border-border bg-surface-1">
      <div className="grid h-full grid-cols-[112px_1fr]">
        <div className="flex flex-col border-r border-border">
          <div className="h-5 border-b border-border" />
          {TRACKS.map((t) => {
            const Icon = TRACK_ICON[t.kind];
            return (
              <div key={t.id} className="flex h-6 items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
                <Icon size={11} strokeWidth={1.5} />
                <span className="truncate">{t.name}</span>
              </div>
            );
          })}
        </div>
        <div className="relative overflow-hidden">
          <div className="relative h-5 border-b border-border">
            {Array.from({ length: 11 }, (_, i) => i * 10).map((s) => (
              <span key={s} className="absolute top-0 text-[9px] tabular-nums text-muted-foreground/70" style={{ left: pct(s) }}>
                <span className="absolute left-0 top-3 h-2 w-px bg-border" />
                <span className="pl-1">{s}s</span>
              </span>
            ))}
          </div>
          {TRACKS.map((t) => (
            <div key={t.id} className="relative h-6 border-b border-border/50">
              {CLIPS.filter((c) => c.trackId === t.id).map((c) => {
                const selected = c.id === SELECTED_CLIP.id;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "absolute inset-y-[3px] flex items-center overflow-hidden rounded-[3px] px-1.5 text-[10px]",
                      selected ? "text-black ring-1 ring-white" : "text-white/70 opacity-45",
                    )}
                    style={{ left: pct(c.start), width: pct(c.duration), background: c.tint }}
                  >
                    <span className="truncate">{c.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-red-400" style={{ left: pct(PLAYHEAD) }}>
            <span className="absolute -left-[4px] top-0 size-[9px] rounded-b-[2px] bg-red-400" />
          </div>
        </div>
      </div>
    </section>
  );
}
