"use client";

/**
 * Shared editor frame for the media-library step. Renders the quiet
 * neighbours (top bar, preview, timeline strip) around the focal library
 * panel, and owns the pointer-based drag system: any variant calls
 * `beginDrag(assets, event)` and the frame draws the ghost, highlights the
 * target track and appends clips on drop.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, Film, Image as ImageIcon, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import type { IconComponent } from "#/lib/icon-context.tsx";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import {
  ASSETS,
  CLIPS,
  PROJECTS,
  TRACKS,
  fileSize,
  shortDuration,
  timecode,
  type Asset,
  type AssetKind,
  type Clip,
  type Track,
} from "#/prototypes/mock";

// ── Asset helpers ─────────────────────────────────────────

export const KIND_ICON: Record<AssetKind, IconComponent> = { video: Film, audio: AudioLines, image: ImageIcon };
export const KIND_LABEL: Record<AssetKind, string> = { video: "Video", audio: "Audio", image: "Image" };
export const KIND_ORDER: AssetKind[] = ["video", "audio", "image"];

export function resolution(a: Asset): string {
  return a.width && a.height ? `${a.width}×${a.height}` : "—";
}

export function shortRes(a: Asset): string | null {
  if (!a.width || !a.height) return null;
  const long = Math.max(a.width, a.height);
  if (long >= 3840) return "4K";
  if (long >= 2560) return "2.5K";
  if (long >= 1920) return "1080p";
  return `${a.height}p`;
}

/** Auto-tags derived from metadata — used by chips, Smart search, Bins. */
export function tagsOf(a: Asset): string[] {
  const t: string[] = [];
  if (a.width && Math.max(a.width, a.height ?? 0) >= 3840) t.push("4K");
  if (a.fps === 60) t.push("60fps");
  if (a.name.startsWith("screen_")) t.push("Screen");
  if (a.name.startsWith("broll_")) t.push("B-roll");
  if (a.name.startsWith("intro_")) t.push("Camera");
  if (a.name.startsWith("voiceover")) t.push("Voice");
  if (a.name.startsWith("bgm_")) t.push("Music");
  if (a.name.startsWith("sfx_")) t.push("SFX");
  if (a.name.startsWith("slide_")) t.push("Slides");
  if (a.name.includes("logo")) t.push("Logo");
  return t;
}

export const ALL_TAGS = ["4K", "60fps", "Screen", "Camera", "B-roll", "Voice", "Music", "SFX", "Slides", "Logo"];

export type SortKey = "name" | "kind" | "duration" | "size" | "added" | "resolution";
export type SortDir = "asc" | "desc";

export const SORT_LABEL: Record<SortKey, string> = {
  name: "Name",
  kind: "Kind",
  duration: "Duration",
  size: "Size",
  added: "Date added",
  resolution: "Resolution",
};

export function sortAssets(list: Asset[], key: SortKey, dir: SortDir): Asset[] {
  const sign = dir === "asc" ? 1 : -1;
  const px = (a: Asset) => (a.width ?? 0) * (a.height ?? 0);
  return [...list].sort((a, b) => {
    let r = 0;
    switch (key) {
      case "name": r = a.name.localeCompare(b.name); break;
      case "kind": r = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name); break;
      case "duration": r = a.duration - b.duration; break;
      case "size": r = a.size - b.size; break;
      case "added": r = a.addedAt.localeCompare(b.addedAt); break;
      case "resolution": r = px(a) - px(b); break;
    }
    return r * sign;
  });
}

export function matchesQuery(a: Asset, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [a.name, a.kind, resolution(a), shortRes(a) ?? "", ...tagsOf(a), a.fps ? `${a.fps}fps` : ""].join(" ").toLowerCase();
  return s.split(/\s+/).every((w) => hay.includes(w));
}

/** Deterministic pseudo-waveform for audio thumbnails. */
export function waveform(seed: string, n = 32): number[] {
  let h = 2166136261;
  for (const ch of seed) h = (h ^ ch.charCodeAt(0)) * 16777619;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const v = 0.25 + ((h >> 8) % 1000) / 1000 * 0.75;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

/** Solid/gradient fill standing in for a thumbnail. */
export function Thumb({ asset, className, children, bars: barCount = 32 }: { asset: Asset; className?: string; children?: ReactNode; /** Waveform bar count for audio; use ~12 in compact rows. */ bars?: number }) {
  const bars = useMemo(() => (asset.kind === "audio" ? waveform(asset.id, barCount) : null), [asset.id, asset.kind, barCount]);
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        background:
          asset.kind === "audio"
            ? `color-mix(in oklab, ${asset.tint} 22%, var(--surface-3))`
            : `linear-gradient(135deg, ${asset.tint} 0%, color-mix(in oklab, ${asset.tint} 55%, #000) 100%)`,
      }}
    >
      {bars && (
        <div className={cn("absolute inset-y-0 flex items-center gap-px", barCount <= 16 ? "inset-x-1" : "inset-x-2")}>
          {bars.map((v, i) => (
            <span key={i} className="flex-1 rounded-full" style={{ height: `${v * 70}%`, background: asset.tint }} />
          ))}
        </div>
      )}
      {asset.kind === "image" && (
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 30%, #fff 0, transparent 45%)" }} />
      )}
      {children}
    </div>
  );
}

// ── Drag system ───────────────────────────────────────────

export interface DragState {
  assets: Asset[];
  x: number;
  y: number;
  /** Track under the pointer (compat-resolved), null when not over the timeline. */
  overTrack: string | null;
  /** Timeline seconds under the pointer. */
  atTime: number | null;
}

export interface BeginDragOptions {
  /** Variant-local drop target; return true to consume the drop. */
  onDrop?: (pt: { x: number; y: number }, assets: Asset[]) => boolean;
}

interface FrameApi {
  beginDrag: (assets: Asset | Asset[], e: ReactPointerEvent, opts?: BeginDragOptions) => void;
  dragging: DragState | null;
  addClips: (assets: Asset[], trackId?: string, at?: number) => void;
  clips: Clip[];
  setPreview: (asset: Asset | null) => void;
}

const FrameContext = createContext<FrameApi | null>(null);

export function useFrame(): FrameApi {
  const ctx = useContext(FrameContext);
  if (!ctx) throw new Error("useFrame must be used inside <EditorFrame>");
  return ctx;
}

const DRAG_THRESHOLD = 4;
const VISIBLE_SECONDS = 120;
const TRACK_HEADER_W = 84;

function compatibleTracks(kind: AssetKind): Track[] {
  return TRACKS.filter((t) => (kind === "audio" ? t.kind === "audio" : t.kind === "video"));
}

function resolveTrack(kind: AssetKind, wanted: Track): Track {
  const ok = compatibleTracks(kind);
  if (ok.some((t) => t.id === wanted.id)) return wanted;
  const wi = TRACKS.findIndex((t) => t.id === wanted.id);
  return ok.reduce((best, t) => {
    const d = Math.abs(TRACKS.findIndex((x) => x.id === t.id) - wi);
    const bd = Math.abs(TRACKS.findIndex((x) => x.id === best.id) - wi);
    return d < bd ? t : best;
  }, ok[0]);
}

// ── Editor frame ──────────────────────────────────────────

interface EditorFrameProps {
  children: ReactNode;
  /** Width of the focal library panel in px. */
  panelWidth?: number;
  className?: string;
}

export function EditorFrame({ children, panelWidth = 360, className }: EditorFrameProps) {
  const project = PROJECTS[0];
  const [clips, setClips] = useState<Clip[]>(CLIPS);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<Asset | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [playhead] = useState(27.6);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const lanesRef = useRef<HTMLDivElement>(null);
  const seq = useRef(100);

  const announce = useCallback((text: string) => {
    seq.current += 1;
    setToast({ id: seq.current, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const addClips = useCallback(
    (assets: Asset[], trackId?: string, at?: number) => {
      if (assets.length === 0) return;
      setClips((prev) => {
        const next = [...prev];
        let cursor = at ?? playhead;
        for (const a of assets) {
          const wanted = trackId ? TRACKS.find((t) => t.id === trackId) ?? TRACKS[3] : compatibleTracks(a.kind)[0];
          const track = resolveTrack(a.kind, wanted);
          const own = next.filter((c) => c.trackId === track.id);
          const dur = a.kind === "image" ? 5 : Math.min(a.duration, 24);
          let start = cursor;
          // Push right past any clip overlapping the requested start.
          for (const c of own.sort((x, y) => x.start - y.start)) {
            if (start < c.start + c.duration && start + dur > c.start) start = c.start + c.duration;
          }
          seq.current += 1;
          next.push({ id: `n${seq.current}`, trackId: track.id, assetId: a.id, label: a.name.replace(/\.[^.]+$/, ""), start, duration: dur, inPoint: 0, tint: a.tint });
          cursor = start + dur;
        }
        return next;
      });
      const first = assets[0];
      const t = resolveTrack(first.kind, trackId ? TRACKS.find((x) => x.id === trackId) ?? TRACKS[3] : compatibleTracks(first.kind)[0]);
      announce(assets.length === 1 ? `Added ${first.name} to ${t.name}` : `Added ${assets.length} clips to ${t.name}`);
    },
    [announce, playhead],
  );

  const hitTest = useCallback((x: number, y: number): { track: Track; time: number } | null => {
    const lanes = lanesRef.current;
    if (!lanes) return null;
    const lr = lanes.getBoundingClientRect();
    if (x < lr.left || x > lr.right || y < lr.top || y > lr.bottom) return null;
    for (const t of TRACKS) {
      const el = rowRefs.current.get(t.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) {
        const frac = Math.min(1, Math.max(0, (x - (lr.left + TRACK_HEADER_W)) / (lr.width - TRACK_HEADER_W)));
        return { track: t, time: Math.round(frac * VISIBLE_SECONDS * 10) / 10 };
      }
    }
    return null;
  }, []);

  const beginDrag = useCallback(
    (input: Asset | Asset[], e: ReactPointerEvent, opts?: BeginDragOptions) => {
      if (e.button !== 0) return;
      const assets = Array.isArray(input) ? input : [input];
      if (assets.length === 0) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let started = false;

      const onMove = (ev: PointerEvent) => {
        if (!started) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
          started = true;
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }
        const hit = hitTest(ev.clientX, ev.clientY);
        setDragging({
          assets,
          x: ev.clientX,
          y: ev.clientY,
          overTrack: hit ? resolveTrack(assets[0].kind, hit.track).id : null,
          atTime: hit ? hit.time : null,
        });
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (!started) return;
        setDragging(null);
        if (opts?.onDrop?.({ x: ev.clientX, y: ev.clientY }, assets)) return;
        const hit = hitTest(ev.clientX, ev.clientY);
        if (hit) addClips(assets, hit.track.id, hit.time);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [addClips, hitTest],
  );

  const api = useMemo<FrameApi>(() => ({ beginDrag, dragging, addClips, clips, setPreview }), [beginDrag, dragging, addClips, clips]);

  const previewAsset = preview ?? ASSETS[0];
  const pxPerSec = 1; // scaled via percentages below

  return (
    <FrameContext.Provider value={api}>
      <div className={cn("flex h-full w-full flex-col bg-surface-1 text-foreground", className)}>
        {/* Top bar */}
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3 text-xs">
          <span className="truncate font-medium">{project.name}</span>
          <span className="text-muted-foreground">{project.width}×{project.height} · {project.fps}fps</span>
          <span className="ml-auto rounded-md bg-surface-4 px-2 py-1 text-muted-foreground">Autosaved</span>
          <span className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground">Export</span>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Focal panel */}
          <aside style={{ width: panelWidth }} className="relative flex shrink-0 flex-col border-r border-border bg-surface-2">
            {children}
          </aside>

          {/* Neighbours */}
          <main className="flex min-w-0 flex-1 flex-col">
            <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
              <div className="relative aspect-video w-full max-w-[720px] overflow-hidden rounded-lg border border-border shadow-surface-2">
                <Thumb asset={previewAsset} className="h-full w-full opacity-60" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2 text-[11px] text-white/80">
                  <span className="truncate">{previewAsset.name}</span>
                  <span className="tabular-nums">{timecode(playhead, project.fps)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <SkipBack size={14} strokeWidth={1.5} />
                <span className="grid size-7 place-items-center rounded-full bg-surface-4 text-foreground"><Play size={12} strokeWidth={2} /></span>
                <SkipForward size={14} strokeWidth={1.5} />
                <span className="ml-2 text-[11px] tabular-nums">{timecode(playhead, project.fps)} / {timecode(project.duration, project.fps)}</span>
                <Volume2 size={14} strokeWidth={1.5} className="ml-2" />
              </div>
            </section>

            {/* Timeline strip */}
            <section className="relative shrink-0 border-t border-border bg-surface-2" ref={lanesRef}>
              <div className="flex h-6 items-end border-b border-border text-[10px] text-muted-foreground">
                <div style={{ width: TRACK_HEADER_W }} className="shrink-0" />
                <div className="relative flex-1">
                  {Array.from({ length: 13 }, (_, i) => (
                    <span key={i} className="absolute bottom-0.5 tabular-nums" style={{ left: `${(i * 10) / VISIBLE_SECONDS * 100}%` }}>
                      {i * 10}s
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative">
                {TRACKS.map((t) => {
                  const own = clips.filter((c) => c.trackId === t.id);
                  const isOver = dragging?.overTrack === t.id;
                  return (
                    <div
                      key={t.id}
                      ref={(el) => { if (el) rowRefs.current.set(t.id, el); else rowRefs.current.delete(t.id); }}
                      className={cn("flex h-7 items-stretch border-b border-border/60 transition-colors duration-80", isOver && "bg-selected/30")}
                    >
                      <div style={{ width: TRACK_HEADER_W }} className="flex shrink-0 items-center gap-1.5 border-r border-border px-2 text-[11px] text-muted-foreground">
                        <span className="size-1.5 rounded-full" style={{ background: t.kind === "audio" ? "#06d6a0" : t.kind === "video" ? "#3a86ff" : "#94a3b8" }} />
                        {t.name}
                      </div>
                      <div className="relative flex-1">
                        {own.map((c) => (
                          <motion.div
                            key={c.id}
                            layout
                            initial={{ opacity: 0, scaleY: 0.6 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            transition={spring.moderate}
                            className="absolute inset-y-[3px] flex items-center overflow-hidden rounded-[4px] px-1.5 text-[10px] text-white/90"
                            style={{ left: `${(c.start * pxPerSec) / VISIBLE_SECONDS * 100}%`, width: `max(${(c.duration * pxPerSec) / VISIBLE_SECONDS * 100}%, 6px)`, background: c.tint }}
                          >
                            <span className="truncate">{c.label}</span>
                          </motion.div>
                        ))}
                        {isOver && dragging?.atTime !== null && dragging && (
                          <div
                            className="absolute inset-y-[3px] rounded-[4px] border border-dashed border-foreground/60 bg-foreground/10"
                            style={{ left: `${dragging.atTime / VISIBLE_SECONDS * 100}%`, width: `${Math.min(dragging.assets[0].kind === "image" ? 5 : Math.min(dragging.assets[0].duration, 24), 30) / VISIBLE_SECONDS * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Playhead */}
                <div className="pointer-events-none absolute inset-y-0 w-px bg-red-400" style={{ left: `calc(${TRACK_HEADER_W}px + (100% - ${TRACK_HEADER_W}px) * ${playhead / VISIBLE_SECONDS})` }} />
              </div>

              <AnimatePresence>
                {toast && (
                  <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={spring.moderate}
                    className="pointer-events-none absolute right-3 top-8 rounded-md bg-surface-6 px-2.5 py-1 text-[11px] shadow-surface-4"
                  >
                    {toast.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </main>
        </div>

        {/* Drag ghost */}
        <AnimatePresence>
          {dragging && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={spring.fast}
              className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-md bg-surface-6 py-1 pl-1 pr-2.5 text-xs shadow-surface-5"
              style={{ left: dragging.x + 10, top: dragging.y + 10 }}
            >
              <Thumb asset={dragging.assets[0]} className="h-6 w-10 rounded-[4px]" bars={12} />
              <span className="max-w-[160px] truncate">{dragging.assets.length > 1 ? `${dragging.assets.length} items` : dragging.assets[0].name}</span>
              {dragging.assets.length === 1 && dragging.assets[0].kind !== "image" && (
                <span className="tabular-nums text-muted-foreground">{shortDuration(dragging.assets[0].duration)}</span>
              )}
              {dragging.overTrack && <span className="text-[10px] text-muted-foreground">→ {TRACKS.find((t) => t.id === dragging.overTrack)?.name}</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FrameContext.Provider>
  );
}

// ── Small shared bits ─────────────────────────────────────

/** Metadata line: "3840×2160 · 30fps · 3m 04s · 2.43 GB" */
export function metaLine(a: Asset): string {
  const parts: string[] = [];
  if (a.width) parts.push(resolution(a));
  if (a.fps) parts.push(`${a.fps}fps`);
  if (a.kind !== "image") parts.push(shortDuration(a.duration));
  parts.push(fileSize(a.size));
  return parts.join(" · ");
}

export function KindIcon({ kind, size = 12, className }: { kind: AssetKind; size?: number; className?: string }) {
  const Icon = KIND_ICON[kind];
  return <Icon size={size} strokeWidth={1.75} className={className} />;
}
