/**
 * Import surfaces: the dashed drop target that *is* the empty media panel,
 * the full-window catch overlay raised while files are dragged anywhere over
 * the app, the per-file progress tiles, and the "imported" toast.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Check, CloudUpload } from "lucide-react";
import { Kbd } from "#/components/ui/kbd";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { fileSize } from "#/editor/core";
import type { PendingImport } from "./import";
import { KIND_LABEL } from "./helpers";

const FORMATS = "MP4, MOV, WAV, MP3, PNG, JPG · up to 4K";

interface DropzoneProps {
  /** True while files hover this target. */
  over: boolean;
  onBrowse: () => void;
  /** Drag handlers from `useDropTarget`. */
  bind: Record<string, unknown>;
}

/** The empty library: one dashed field, one verb. */
export function Dropzone({ over, onBrowse, bind }: DropzoneProps) {
  return (
    <div className="flex min-h-0 flex-1 p-3">
      <div
        {...bind}
        role="button"
        tabIndex={0}
        data-testid="media-dropzone"
        aria-label="Import media: drop files or press Enter to browse"
        onClick={onBrowse}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onBrowse();
          }
        }}
        className={cn(
          "group relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center outline-none transition-colors duration-150",
          "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          over ? "border-foreground/60 bg-selected" : "border-border hover:border-foreground/30 hover:bg-hover",
        )}
      >
        <motion.div
          animate={over ? { y: -4, scale: 1.06 } : { y: 0, scale: 1 }}
          transition={spring.moderate}
          className="grid size-14 place-items-center rounded-full bg-surface-4 text-foreground shadow-surface-4"
        >
          <CloudUpload size={24} strokeWidth={1.5} />
        </motion.div>
        <div className="space-y-1">
          <p className="text-[13px] font-medium">{over ? "Release to import" : "Drop files or click to browse"}</p>
          <p className="text-[11.5px] text-muted-foreground">{FORMATS}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          or paste with <Kbd className="align-middle">⌘V</Kbd>
        </p>
      </div>
    </div>
  );
}

/** Raised while files are dragged over the window; a drop anywhere imports. */
export function WindowDropOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={spring.fast}
          data-testid="media-drop-overlay"
          className="pointer-events-none fixed inset-0 z-50 bg-background/70 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            transition={spring.moderate}
            className="absolute inset-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-foreground/50"
          >
            <CloudUpload size={40} strokeWidth={1.25} />
            <p className="text-[15px] font-medium">Drop to import into “Media”</p>
            <p className="text-[12px] text-muted-foreground">Video, audio and images · you can keep editing meanwhile</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A file mid-import: the card it will become, filling up. */
export function PendingTile({ item }: { item: PendingImport }) {
  const pct = Math.round(item.progress * 100);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={spring.moderate}
      data-testid="media-import-pending"
      className="overflow-hidden rounded-lg ring-1 ring-border"
    >
      <div
        className="relative aspect-[4/3]"
        style={{ background: `linear-gradient(135deg, ${item.tint} 0%, color-mix(in oklab, ${item.tint} 55%, #000) 100%)` }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <span className="absolute right-1.5 top-1.5 rounded-[4px] bg-black/55 px-1 py-px text-[10px] tabular-nums text-white">{pct}%</span>
        <div className="absolute inset-x-3 bottom-3">
          <div
            role="progressbar"
            aria-label={`Importing ${item.name}`}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1 overflow-hidden rounded-full bg-black/40"
          >
            <div className="h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="bg-surface-3 px-2 py-1.5">
        <div className="truncate text-[11px]">{item.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {KIND_LABEL[item.kind]} · {fileSize(item.size)}
        </div>
      </div>
    </motion.div>
  );
}

/** Confirmation after a batch lands. */
export function DoneToast({ count, onDismiss }: { count: number | null; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {count !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={spring.moderate}
          role="status"
          data-testid="media-import-done"
          className="absolute inset-x-3 bottom-11 z-10 flex items-center gap-2 rounded-md bg-surface-4 px-3 py-1.5 text-[12px] shadow-surface-4"
        >
          <Check size={14} strokeWidth={2} />
          {count} file{count > 1 ? "s" : ""} imported
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto cursor-pointer rounded px-1 text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
          >
            Dismiss
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
