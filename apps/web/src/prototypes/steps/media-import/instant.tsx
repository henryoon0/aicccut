/**
 * Instant — no library detour. Dropping anywhere on the editor puts the files
 * straight onto the timeline at the playhead: ghost clips fly from the drop
 * point to the track, materialise as they import, and a small toast offers
 * Undo. The media panel is a quiet ledger that fills in as a side effect.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Undo02Icon, Upload03Icon } from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button.tsx";
import { spring } from "#/lib/springs.ts";
import { cn } from "#/lib/utils.ts";
import { ASSETS, TRACKS, shortDuration, type Asset, type Clip } from "#/prototypes/mock";
import {
  EditorFrame,
  KindIcon,
  PX_PER_SEC,
  Thumb,
  pickAssets,
  useFilePicker,
  useImportQueue,
  usePasteImport,
  useWindowDrag,
  asIcon,
} from "./shared";

const AddIcon = asIcon(Upload03Icon);
const UndoIcon = asIcon(Undo02Icon);

interface Ghost {
  id: string;
  asset: Asset;
  from: { x: number; y: number };
  to: { x: number; y: number; w: number };
}

interface Batch {
  id: string;
  clipIds: string[];
  assetIds: string[];
}

const PLAYHEAD = 27.4;

export function Instant() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [lastBatch, setLastBatch] = useState<Batch | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const timeline = useRef<HTMLDivElement | null>(null);
  const q = useImportQueue({ initialLibrary: ASSETS.slice(0, 3) });

  const place = useCallback(
    (n: number, point?: { x: number; y: number }) => {
      const assets = pickAssets(n, q.library);
      // Audio has no place on a video track: it imports to Media only.
      const placeable = assets.filter((a) => a.kind !== "audio");
      const rootRect = overlay.current?.getBoundingClientRect();
      const tlRect = timeline.current?.getBoundingClientRect();
      const rowV1 = TRACKS.findIndex((t) => t.id === "t-v1");
      const rowV2 = TRACKS.findIndex((t) => t.id === "t-v2");
      const origin = point && rootRect ? { x: point.x - rootRect.left, y: point.y - rootRect.top } : { x: (rootRect?.width ?? 800) / 2, y: 120 };

      let cursor = PLAYHEAD;
      const newClips: Clip[] = [];
      const newGhosts: Ghost[] = [];
      placeable.forEach((a, i) => {
        const d = a.kind === "image" ? 4 : Math.min(a.duration, 10);
        // Alternate V1/V2 so stacked drops read as a sequence, not a pile.
        const row = i % 2 === 0 ? rowV1 : rowV2;
        const clip: Clip = { id: `ins-${a.id}`, trackId: TRACKS[row].id, assetId: a.id, label: a.name.replace(/\.\w+$/, ""), start: cursor, duration: d, inPoint: 0, tint: a.tint };
        newClips.push(clip);
        if (rootRect && tlRect) {
          newGhosts.push({
            id: clip.id,
            asset: a,
            from: { x: origin.x + i * 10, y: origin.y + i * 6 },
            to: { x: tlRect.left - rootRect.left + cursor * PX_PER_SEC, y: tlRect.top - rootRect.top + row * 32 + 4, w: Math.max(8, d * PX_PER_SEC) },
          });
        }
        cursor += d;
      });
      setGhosts((g) => [...g, ...newGhosts]);
      // Clips appear once the ghosts land; imports start now.
      q.enqueue(assets);
      window.setTimeout(() => {
        setClips((c) => [...c, ...newClips]);
        setGhosts((g) => g.filter((x) => !newGhosts.some((ng) => ng.id === x.id)));
      }, 380);
      setLastBatch({ id: `b-${Date.now()}`, clipIds: newClips.map((c) => c.id), assetIds: assets.map((a) => a.id) });
    },
    [q],
  );

  const dragging = useWindowDrag((n, pt) => place(n, pt));
  const picker = useFilePicker((n) => place(n));
  usePasteImport(() => place(1));

  const undo = () => {
    if (!lastBatch) return;
    setClips((c) => c.filter((x) => !lastBatch.clipIds.includes(x.id)));
    q.removeFromLibrary(lastBatch.assetIds);
    lastBatch.assetIds.forEach((aid) => {
      const it = q.items.find((i) => i.asset.id === aid);
      if (it) q.removeItem(it.id);
    });
    setLastBatch(null);
  };

  const progressOf = (assetId?: string) => q.items.find((i) => i.asset.id === assetId)?.progress ?? 1;

  // Timeline geometry, measured in an effect (never during render) so the
  // veils and the insertion mark line up with the real track strip.
  const [rects, setRects] = useState<{ tl: DOMRect; root: DOMRect } | null>(null);
  useEffect(() => {
    const measure = () => {
      if (!timeline.current || !overlay.current) return;
      setRects({ tl: timeline.current.getBoundingClientRect(), root: overlay.current.getBoundingClientRect() });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (overlay.current) ro.observe(overlay.current);
    return () => ro.disconnect();
  }, []);
  const tlRect = rects?.tl;
  const rootRect = rects?.root;

  return (
    <EditorFrame
      playhead={PLAYHEAD}
      extraClips={clips}
      timelineRef={(el) => { timeline.current = el; }}
      mediaWidth={280}
      topbar={
        <Button variant="ghost" size="compact" leadingIcon={AddIcon} onClick={picker.open}>
          Add to timeline
        </Button>
      }
      media={
        <div className="flex min-h-0 flex-1 flex-col">
          {picker.input}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-[12px]">
            <span className="font-medium">Media</span>
            <span className="text-[11px] text-muted-foreground">{q.library.length} items</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {q.library.map((a) => {
              const p = progressOf(a.id);
              return (
                <div key={a.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover">
                  <Thumb asset={a} className="h-7 w-11 shrink-0 rounded-[3px]" dim={p < 1} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px]">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">{a.duration ? shortDuration(a.duration) : `${a.width}×${a.height}`}</div>
                  </div>
                  <span className="text-muted-foreground"><KindIcon kind={a.kind} size={12} /></span>
                </div>
              );
            })}
            {q.items.filter((i) => i.status !== "done").map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-md px-1.5 py-1">
                <div className="relative h-7 w-11 shrink-0 overflow-hidden rounded-[3px] bg-surface-4">
                  <div className="absolute inset-y-0 left-0 transition-[width] duration-100" style={{ width: `${i.progress * 100}%`, background: i.asset.tint, opacity: 0.8 }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] text-muted-foreground">{i.asset.name}</div>
                  <div className="font-mono text-[10px] tabular-nums text-muted-foreground">{Math.round(i.progress * 100)}%</div>
                </div>
              </div>
            ))}
          </div>
          <div className="shrink-0 border-t border-border p-2.5 text-[10.5px] leading-snug text-muted-foreground">
            Drop anywhere to place at the playhead. Audio goes to Media only.
          </div>
        </div>
      }
    >
      <div ref={overlay} className="pointer-events-none absolute inset-0 z-30">
        {/* Import progress veils over the landed clips */}
        {tlRect && rootRect && clips.map((c) => {
          const p = progressOf(c.assetId);
          if (p >= 1) return null;
          const row = TRACKS.findIndex((t) => t.id === c.trackId);
          return (
            <div
              key={`veil-${c.id}`}
              className="absolute h-6 overflow-hidden rounded-[4px]"
              style={{ left: tlRect.left - rootRect.left + c.start * PX_PER_SEC, top: tlRect.top - rootRect.top + row * 32 + 4, width: Math.max(8, c.duration * PX_PER_SEC) }}
            >
              <div className="absolute inset-y-0 right-0 bg-surface-2/85 transition-[width] duration-100" style={{ width: `${(1 - p) * 100}%` }} />
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-foreground/80 transition-[width] duration-100" style={{ width: `${p * 100}%` }} />
            </div>
          );
        })}

        {/* Ghosts flying from the drop point to their slot */}
        <AnimatePresence>
          {ghosts.map((g) => (
            <motion.div
              key={g.id}
              initial={{ x: g.from.x - 40, y: g.from.y - 12, width: 80, height: 24, opacity: 0.9, scale: 1.1 }}
              animate={{ x: g.to.x, y: g.to.y, width: g.to.w, height: 24, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", duration: 0.38, bounce: 0.1 }}
              className="absolute overflow-hidden rounded-[4px] px-1.5 text-[10px] leading-6 text-white/90 shadow-surface-5"
              style={{ background: `color-mix(in oklab, ${g.asset.tint} 75%, black)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${g.asset.tint} 60%, white)` }}
            >
              <span className="truncate">{g.asset.name.replace(/\.\w+$/, "")}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Whole-editor drag hint: a playhead-anchored insertion mark */}
      <AnimatePresence>
        {dragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.fast} className="pointer-events-none absolute inset-0 z-20">
            <div className="absolute inset-0 bg-background/40" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-surface-5 px-3 py-2 text-[12px] shadow-surface-5">
              Release to add at <span className="font-mono tabular-nums">00:00:27</span>
            </div>
            {tlRect && rootRect && (
              <motion.div
                initial={{ scaleY: 0.6 }}
                animate={{ scaleY: 1 }}
                className="absolute w-[3px] rounded-full bg-foreground"
                style={{ left: tlRect.left - rootRect.left + PLAYHEAD * PX_PER_SEC - 1, top: tlRect.top - rootRect.top, height: tlRect.height }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo toast */}
      <AnimatePresence>
        {lastBatch && (
          <motion.div
            key={lastBatch.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={spring.moderate}
            className={cn("absolute bottom-[224px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md bg-surface-5 py-1.5 pl-3 pr-1.5 text-[12px] shadow-surface-5")}
            style={{ marginLeft: 140 }}
          >
            <span>
              {lastBatch.clipIds.length} clip{lastBatch.clipIds.length > 1 ? "s" : ""} added
              {q.active ? " · importing" : ""}
            </span>
            <span className="text-muted-foreground">·</span>
            <Button variant="ghost" size="compact" leadingIcon={UndoIcon} onClick={undo}>
              Undo
            </Button>
            <button type="button" aria-label="Dismiss" onClick={() => setLastBatch(null)} className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-hover hover:text-foreground">
              <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </EditorFrame>
  );
}
