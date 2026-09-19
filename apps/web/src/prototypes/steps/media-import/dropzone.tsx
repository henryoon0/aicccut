/**
 * Dropzone — the empty media panel *is* the drop target. One dashed field,
 * one verb. Dragging anywhere over the window raises a full-screen catch
 * overlay; each file imports as a bar right where its card will live.
 */
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { CloudUploadIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button.tsx";
import { Kbd } from "#/components/ui/kbd.tsx";
import { spring } from "#/lib/springs.ts";
import { cn } from "#/lib/utils.ts";
import { fileSize, shortDuration } from "#/prototypes/mock";
import {
  EditorFrame,
  KindIcon,
  Thumb,
  metaLine,
  useDropTarget,
  useFilePicker,
  useImportQueue,
  usePasteImport,
  useWindowDrag,
} from "./shared";

export function Dropzone() {
  const q = useImportQueue();
  const start = (n: number) => q.importSome(n);
  const { over, bind } = useDropTarget((n) => start(n));
  const windowDragging = useWindowDrag((n) => start(n));
  const picker = useFilePicker(start);
  usePasteImport(() => start(1));

  const empty = q.library.length === 0 && q.items.length === 0;
  const pending = q.items.filter((i) => i.status !== "done");

  return (
    <EditorFrame
      mediaWidth={340}
      media={
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-[12px]">
            <span className="font-medium">Media</span>
            {!empty && (
              <Button variant="ghost" size="compact" onClick={picker.open}>
                Import
              </Button>
            )}
          </div>
          {picker.input}

          {empty ? (
            <div className="flex min-h-0 flex-1 p-3">
              <div
                {...bind}
                role="button"
                tabIndex={0}
                aria-label="Import media: drop files or press Enter to browse"
                onClick={picker.open}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    picker.open();
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
                  <HugeiconsIcon icon={CloudUploadIcon} size={24} strokeWidth={1.5} />
                </motion.div>
                <div className="space-y-1">
                  <p className="text-[13px] font-medium">{over ? "Release to import" : "Drop files or click to browse"}</p>
                  <p className="text-[11.5px] text-muted-foreground">MP4, MOV, WAV, MP3, PNG, JPG · up to 4K</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  or paste with <Kbd className="align-middle">⌘V</Kbd>
                </p>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-3" {...bind}>
              <div className={cn("grid grid-cols-2 gap-2 rounded-lg transition-colors", over && "bg-selected")}>
                {q.library.map((a) => (
                  <div key={a.id} className="group overflow-hidden rounded-md bg-surface-3 ring-1 ring-border transition-colors hover:ring-foreground/30">
                    <Thumb asset={a} className="aspect-video" />
                    <div className="px-2 py-1.5">
                      <div className="flex items-center gap-1 text-[11.5px]">
                        <span className="text-muted-foreground"><KindIcon kind={a.kind} size={12} /></span>
                        <span className="truncate">{a.name}</span>
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">{metaLine(a)}{a.duration ? ` · ${shortDuration(a.duration)}` : ""}</div>
                    </div>
                  </div>
                ))}
                <AnimatePresence>
                  {pending.map((it) => (
                    <motion.div
                      key={it.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={spring.moderate}
                      className="overflow-hidden rounded-md bg-surface-3 ring-1 ring-border"
                    >
                      <div className="relative aspect-video">
                        <Thumb asset={it.asset} className="absolute inset-0" dim />
                        <div className="absolute inset-x-3 bottom-3">
                          <div className="h-1 overflow-hidden rounded-full bg-black/40">
                            <div className="h-full rounded-full bg-foreground transition-[width] duration-100" style={{ width: `${it.progress * 100}%` }} />
                          </div>
                        </div>
                        <span className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/90">
                          {Math.round(it.progress * 100)}%
                        </span>
                      </div>
                      <div className="px-2 py-1.5">
                        <div className="truncate text-[11.5px]">{it.asset.name}</div>
                        <div className="text-[10.5px] text-muted-foreground">{it.status === "queued" ? "Waiting…" : `Importing · ${fileSize(it.asset.size)}`}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {pending.length === 0 && (
                <p className="mt-4 text-center text-[11px] text-muted-foreground">Drop more files anywhere · ⌘V to paste</p>
              )}
            </div>
          )}
        </div>
      }
    >
      {/* Full-window catch overlay */}
      <AnimatePresence>
        {windowDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.fast}
            className="pointer-events-none absolute inset-0 z-40 bg-background/70 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.98 }}
              animate={{ scale: 1 }}
              transition={spring.moderate}
              className="absolute inset-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-foreground/50"
            >
              <HugeiconsIcon icon={CloudUploadIcon} size={40} strokeWidth={1.25} />
              <p className="text-[15px] font-medium">Drop to import into “Media”</p>
              <p className="text-[12px] text-muted-foreground">Video, audio and images · you can keep editing meanwhile</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!q.active && q.library.length > 0 && q.items.length > 0 && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.moderate}
            className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-surface-4 px-3 py-1.5 text-[12px] shadow-surface-4"
          >
            <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} />
            {q.items.length} file{q.items.length > 1 ? "s" : ""} imported
            <button type="button" onClick={q.clearDone} className="ml-1 rounded px-1 text-muted-foreground hover:bg-hover hover:text-foreground">
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </EditorFrame>
  );
}
