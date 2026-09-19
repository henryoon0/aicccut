/**
 * Helpers shared by the five media-import variants: a realistic editor frame
 * (top bar, preview, timeline strip) around a swappable media panel, plus a
 * fake import queue that turns a drop / pick / paste into 2–4 s of progress.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Image01Icon,
  MusicNote01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "#/lib/utils.ts";
import type { IconComponent } from "#/lib/icon-context.tsx";
import {
  ASSETS,
  CLIPS,
  PROJECTS,
  PROJECT_DURATION,
  TRACKS,
  shortDuration,
  timecode,
  type Asset,
  type AssetKind,
  type Clip,
} from "#/prototypes/mock";

// ── Fake import queue ──────────────────────────────────────

export type ImportStatus = "queued" | "importing" | "done";

export interface ImportItem {
  id: string;
  asset: Asset;
  /** 0 … 1 */
  progress: number;
  status: ImportStatus;
  /** ms this file takes end to end (2–4 s, varies per file). */
  durationMs: number;
  startedAt?: number;
  /** Set while the user has paused this file; progress holds. */
  pausedAt?: number;
}

interface QueueOptions {
  /** How many files import at once; the rest wait. Default: all at once. */
  concurrency?: number;
  /** Assets already in the library when the variant mounts. */
  initialLibrary?: Asset[];
  onItemDone?: (item: ImportItem) => void;
}

let uid = 0;
const nextId = () => `imp-${++uid}-${Math.random().toString(36).slice(2, 6)}`;

/** Pick `n` assets not yet in the library; wrap around with a "(2)" suffix. */
export function pickAssets(n: number, taken: Asset[]): Asset[] {
  const takenNames = new Set(taken.map((a) => a.name.replace(/ \(\d+\)$/, "")));
  const fresh = ASSETS.filter((a) => !takenNames.has(a.name));
  const out: Asset[] = [];
  for (let i = 0; i < n; i++) {
    const src = fresh[i] ?? ASSETS[(taken.length + i) % ASSETS.length];
    const dupes = taken.filter((a) => a.name.startsWith(src.name.replace(/\.\w+$/, ""))).length;
    const name = fresh[i] ? src.name : src.name.replace(/(\.\w+)$/, ` (${dupes + 1})$1`);
    out.push({ ...src, id: `${src.id}-${nextId()}`, name, addedAt: new Date().toISOString() });
  }
  return out;
}

export function useImportQueue({ concurrency = Infinity, initialLibrary = [], onItemDone }: QueueOptions = {}) {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [library, setLibrary] = useState<Asset[]>(initialLibrary);
  const doneRef = useRef(onItemDone);
  doneRef.current = onItemDone;

  const enqueue = useCallback((assets: Asset[]) => {
    setItems((prev) => [
      ...prev,
      ...assets.map<ImportItem>((asset) => ({
        id: nextId(),
        asset,
        progress: 0,
        status: "queued",
        durationMs: 2000 + Math.random() * 2000,
      })),
    ]);
  }, []);

  /** Convenience: enqueue `n` new assets picked from the mock pool. */
  const importSome = useCallback(
    (n: number) => {
      const chosen = pickAssets(n, [...library, ...items.map((i) => i.asset)]);
      enqueue(chosen);
      return chosen;
    },
    [enqueue, library, items],
  );

  const active = items.some((i) => i.status !== "done");

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const now = performance.now();
      setItems((prev) => {
        let running = prev.filter((i) => i.status === "importing").length;
        return prev.map((i) => {
          if (i.status === "done") return i;
          if (i.status === "queued") {
            if (running < concurrency) {
              running++;
              return { ...i, status: "importing" as const, startedAt: now };
            }
            return i;
          }
          if (i.pausedAt !== undefined) return i;
          const t = Math.min(1, (now - (i.startedAt ?? now)) / i.durationMs);
          // Ease so the bar lunges at first and slows near the end, like a
          // real demux + thumbnail pass.
          const eased = 1 - Math.pow(1 - t, 1.6);
          if (t >= 1) return { ...i, progress: 1, status: "done" as const };
          return { ...i, progress: eased };
        });
      });
    };
    const id = setInterval(tick, 48);
    return () => clearInterval(id);
  }, [active, concurrency]);

  // Land finished items in the library exactly once. Done here, outside the
  // state updater, because updaters run during React's render pass and any
  // side effect inside them is either dropped or doubled.
  const landed = useRef(new Set<string>());
  useEffect(() => {
    const fresh = items.filter((i) => i.status === "done" && !landed.current.has(i.id));
    if (fresh.length === 0) return;
    fresh.forEach((f) => landed.current.add(f.id));
    setLibrary((lib) => [...lib, ...fresh.map((f) => f.asset)]);
    fresh.forEach((f) => doneRef.current?.(f));
  }, [items]);

  const clearDone = useCallback(() => setItems((p) => p.filter((i) => i.status !== "done")), []);
  const removeItem = useCallback((id: string) => setItems((p) => p.filter((i) => i.id !== id)), []);
  const togglePause = useCallback((id: string) => {
    const now = performance.now();
    setItems((p) =>
      p.map((i) => {
        if (i.id !== id || i.status !== "importing") return i;
        if (i.pausedAt === undefined) return { ...i, pausedAt: now };
        // Shift the start so the elapsed time excludes the pause.
        return { ...i, pausedAt: undefined, startedAt: (i.startedAt ?? now) + (now - i.pausedAt) };
      }),
    );
  }, []);
  const removeFromLibrary = useCallback(
    (ids: string[]) => setLibrary((lib) => lib.filter((a) => !ids.includes(a.id))),
    [],
  );

  return { items, library, enqueue, importSome, active, clearDone, removeItem, togglePause, removeFromLibrary, setLibrary };
}

// ── Drop target ────────────────────────────────────────────

/** Counter-based drag tracking so nested children don't flicker `over`. */
export function useDropTarget(onDrop: (fileCount: number, point: { x: number; y: number }) => void) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    depth.current++;
    setOver(true);
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const count = e.dataTransfer?.files?.length || e.dataTransfer?.items?.length || 3;
    onDrop(Math.min(Math.max(count, 1), 6), { x: e.clientX, y: e.clientY });
  };
  return { over, bind: { onDragEnter, onDragOver, onDragLeave, onDrop: handleDrop } };
}

/** Whole-window drag detection for full-screen overlays. */
export function useWindowDrag(onDrop: (count: number, point: { x: number; y: number }) => void) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onDrop);
  cb.current = onDrop;
  useEffect(() => {
    const enter = (e: globalThis.DragEvent) => {
      e.preventDefault();
      depth.current++;
      setDragging(true);
    };
    const over = (e: globalThis.DragEvent) => e.preventDefault();
    const leave = (e: globalThis.DragEvent) => {
      e.preventDefault();
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const drop = (e: globalThis.DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const count = e.dataTransfer?.files?.length || e.dataTransfer?.items?.length || 3;
      cb.current(Math.min(Math.max(count, 1), 6), { x: e.clientX, y: e.clientY });
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);
  return dragging;
}

/** Cmd+V anywhere imports one image. */
export function usePasteImport(onPaste: () => void) {
  const cb = useRef(onPaste);
  cb.current = onPaste;
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA/.test(target.tagName)) return;
      cb.current();
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, []);
}

/** A hidden <input type=file> the browse buttons open; selection = fake import. */
export function useFilePicker(onPick: (count: number) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const open = useCallback(() => ref.current?.click(), []);
  const input = (
    <input
      ref={ref}
      type="file"
      multiple
      accept="video/*,audio/*,image/*"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const n = e.target.files?.length ?? 0;
        onPick(n > 0 ? Math.min(n, 6) : 3);
        e.target.value = "";
      }}
    />
  );
  return { open, input };
}

// ── Small visual atoms ─────────────────────────────────────

/** Adapt a Hugeicons glyph to the fluid `leadingIcon` component contract. */
export function asIcon(icon: typeof Video01Icon): IconComponent {
  const Icon: IconComponent = ({ size = 16, className, strokeWidth = 1.5 }) => (
    <HugeiconsIcon icon={icon} size={size} className={className} strokeWidth={strokeWidth} />
  );
  return Icon;
}


export const KIND_ICON: Record<AssetKind, typeof Video01Icon> = {
  video: Video01Icon,
  audio: MusicNote01Icon,
  image: Image01Icon,
};

export function KindIcon({ kind, size = 14 }: { kind: AssetKind; size?: number }) {
  return <HugeiconsIcon icon={KIND_ICON[kind]} size={size} strokeWidth={1.5} />;
}

/** Where a thumbnail would be: tint gradient, audio gets a waveform stripe. */
export function Thumb({ asset, className, dim = false }: { asset: Asset; className?: string; dim?: boolean }) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        background:
          asset.kind === "audio"
            ? `linear-gradient(180deg, color-mix(in oklab, ${asset.tint} 30%, var(--surface-3)), var(--surface-3))`
            : `linear-gradient(135deg, ${asset.tint}, color-mix(in oklab, ${asset.tint} 55%, black))`,
        opacity: dim ? 0.35 : 1,
      }}
    >
      {asset.kind === "audio" && <Waveform tint={asset.tint} />}
    </div>
  );
}

function Waveform({ tint }: { tint: string }) {
  const bars = Array.from({ length: 28 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7) * 0.7));
  return (
    <div className="absolute inset-x-2 inset-y-0 flex items-center gap-[2px]">
      {bars.map((h, i) => (
        <span key={i} className="flex-1 rounded-full" style={{ height: `${h * 60}%`, background: tint, opacity: 0.85 }} />
      ))}
    </div>
  );
}

export function metaLine(a: Asset): string {
  if (a.kind === "image") return `${a.width}×${a.height}`;
  if (a.kind === "audio") return `${shortDuration(a.duration)} · ${a.name.split(".").pop()?.toUpperCase()}`;
  return `${a.height === 2160 ? "4K" : a.height && a.height > 1080 ? `${a.height}p` : "1080p"} · ${a.fps} fps`;
}

// ── Editor frame ───────────────────────────────────────────

const PROJECT = PROJECTS[0];
const PX_PER_SEC = 7.2;

interface FrameProps {
  /** Left panel content (the focal media library). */
  media: ReactNode;
  /** Extra clips to draw on the timeline (Instant variant). */
  extraClips?: Clip[];
  playhead?: number;
  /** Slot in the top bar, right of the project name. */
  topbar?: ReactNode;
  children?: ReactNode;
  /** Ref for the timeline track area, so variants can aim flying ghosts. */
  timelineRef?: (el: HTMLDivElement | null) => void;
  mediaWidth?: number;
}

export function EditorFrame({ media, extraClips = [], playhead = 27.4, topbar, children, timelineRef, mediaWidth = 320 }: FrameProps) {
  const allClips = [...CLIPS, ...extraClips];
  const total = Math.max(PROJECT_DURATION, ...allClips.map((c) => c.start + c.duration)) + 6;
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-surface-1 text-foreground">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3 text-[12px]">
        <span className="size-2 rounded-full" style={{ background: PROJECT.tint }} />
        <span className="truncate font-medium">{PROJECT.name}</span>
        <span className="text-muted-foreground">{PROJECT.width}×{PROJECT.height} · {PROJECT.fps} fps</span>
        <div className="ml-auto flex items-center gap-2">{topbar}</div>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="flex min-h-0 shrink-0 flex-col border-r border-border bg-surface-2" style={{ width: mediaWidth }}>
          {media}
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <section className="relative flex min-h-0 flex-1 items-center justify-center bg-surface-1 p-6">
            <div
              className="relative aspect-video w-full max-w-[720px] overflow-hidden rounded-md shadow-surface-3"
              style={{ background: `radial-gradient(120% 90% at 30% 20%, color-mix(in oklab, ${CLIPS[1].tint} 45%, black), #0b0b10 70%)` }}
            >
              <div className="absolute inset-x-8 top-8 h-2 rounded bg-white/10" />
              <div className="absolute inset-x-8 top-12 h-2 w-2/3 rounded bg-white/10" />
              <div className="absolute bottom-6 left-8 rounded bg-black/40 px-2 py-1 text-[11px] text-white/80">훅(Hook)이란 무엇인가</div>
              <div className="absolute bottom-3 right-3 font-mono text-[11px] tabular-nums text-white/60">{timecode(playhead)}</div>
            </div>
          </section>
          <section className="relative shrink-0 border-t border-border bg-surface-2">
            <div className="flex h-7 items-center gap-2 border-b border-border px-3 text-[11px] text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground">{timecode(playhead)}</span>
              <span>·</span>
              <span>{timecode(total - 6)}</span>
              <span className="ml-auto">Snap on · 1 frame</span>
            </div>
            <div className="flex">
              <div className="w-24 shrink-0 border-r border-border">
                {TRACKS.map((t) => (
                  <div key={t.id} className="flex h-8 items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-surface-6" />
                    {t.name}
                  </div>
                ))}
              </div>
              <div ref={timelineRef} className="relative min-w-0 flex-1 overflow-hidden" style={{ height: TRACKS.length * 32 }}>
                <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 36px)" }} />
                {allClips.map((c) => {
                  const row = TRACKS.findIndex((t) => t.id === c.trackId);
                  return (
                    <div
                      key={c.id}
                      className="absolute flex h-6 items-center overflow-hidden rounded-[4px] px-1.5 text-[10px] text-white/90"
                      style={{ top: row * 32 + 4, left: c.start * PX_PER_SEC, width: Math.max(8, c.duration * PX_PER_SEC), background: `color-mix(in oklab, ${c.tint} 75%, black)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c.tint} 60%, white)` }}
                    >
                      <span className="truncate">{c.label}</span>
                    </div>
                  );
                })}
                <div className="pointer-events-none absolute inset-y-0 w-px bg-destructive" style={{ left: playhead * PX_PER_SEC }}>
                  <span className="absolute -left-[5px] -top-0 size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-destructive" />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      {children}
    </div>
  );
}

export { PX_PER_SEC, PROJECT };
