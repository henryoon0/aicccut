/**
 * Queue — long imports should never own the screen. Every file becomes a
 * card in a bottom-right stack (Sonner-style: collapsed into one pile, fans
 * out on hover) while the editor stays fully usable. The panel just grows.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, PauseIcon, PlayIcon, Tick02Icon, Upload03Icon } from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button.tsx";
import { spring } from "#/lib/springs.ts";
import { cn } from "#/lib/utils.ts";
import { ASSETS, fileSize, shortDuration } from "#/prototypes/mock";
import {
  EditorFrame,
  KindIcon,
  Thumb,
  useDropTarget,
  useFilePicker,
  useImportQueue,
  usePasteImport,
  type ImportItem,
  asIcon,
} from "./shared";

const ImportIcon = asIcon(Upload03Icon);

const MAX_VISIBLE = 4;

export function Queue() {
  const q = useImportQueue({ initialLibrary: ASSETS.slice(0, 5), concurrency: 2 });
  const [expanded, setExpanded] = useState(false);
  const start = (n: number) => q.importSome(n);
  const { over, bind } = useDropTarget((n) => start(n));
  const picker = useFilePicker(start);
  usePasteImport(() => start(1));

  const stack = [...q.items].reverse();
  const running = q.items.filter((i) => i.status === "importing").length;
  const queued = q.items.filter((i) => i.status === "queued").length;
  const done = q.items.filter((i) => i.status === "done").length;
  const bytesLeft = q.items.filter((i) => i.status !== "done").reduce((n, i) => n + i.asset.size * (1 - i.progress), 0);

  return (
    <EditorFrame
      mediaWidth={300}
      topbar={
        <Button variant="secondary" size="compact" leadingIcon={ImportIcon} onClick={picker.open}>
          Import
        </Button>
      }
      media={
        <div className={cn("flex min-h-0 flex-1 flex-col transition-colors", over && "bg-selected")} {...bind}>
          {picker.input}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-[12px]">
            <span className="font-medium">Media</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{q.library.length}{q.active ? ` · +${running + queued}` : ""}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-1.5">
              <AnimatePresence initial={false}>
                {[...q.library].reverse().map((a) => (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring.moderate}
                    className="group overflow-hidden rounded-md bg-surface-3 ring-1 ring-transparent transition-colors hover:ring-foreground/30"
                  >
                    <div className="relative">
                      <Thumb asset={a} className="aspect-video" />
                      {a.duration > 0 && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 font-mono text-[9.5px] tabular-nums text-white/90">{shortDuration(a.duration)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 px-1.5 py-1 text-[10.5px]">
                      <span className="text-muted-foreground"><KindIcon kind={a.kind} size={11} /></span>
                      <span className="truncate">{a.name}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className={cn("mt-2 rounded-md border border-dashed px-3 py-2.5 text-center text-[10.5px] transition-colors", over ? "border-foreground/60 text-foreground" : "border-border text-muted-foreground")}>
              {over ? "Release to queue" : "Drop here or ⌘V · imports run in the background"}
            </div>
          </div>
        </div>
      }
    >
      {/* Bottom-right toast stack */}
      <div
        className="absolute bottom-3 right-[76px] z-40 flex w-[320px] flex-col items-end"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setExpanded(false); }}
      >
        <AnimatePresence>
          {q.items.length > 0 && (
            <motion.div
              key="summary"
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.moderate}
              className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground"
            >
              {q.active ? (
                <>
                  <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-foreground/40 motion-reduce:hidden" /><span className="relative size-2 rounded-full bg-foreground" /></span>
                  {running} importing{queued ? ` · ${queued} queued` : ""} · {fileSize(bytesLeft)} left
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Tick02Icon} size={12} strokeWidth={2} /> {done} imported
                </>
              )}
              <button type="button" onClick={q.clearDone} className="rounded px-1 hover:bg-hover hover:text-foreground">Clear done</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative w-full" style={{ height: stackHeight(stack.length, expanded) }}>
          <AnimatePresence initial={false}>
            {stack.slice(0, expanded ? 8 : MAX_VISIBLE).map((it, i) => (
              <ToastCard
                key={it.id}
                item={it}
                index={i}
                expanded={expanded}
                onRemove={() => q.removeItem(it.id)}
                onTogglePause={() => q.togglePause(it.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </EditorFrame>
  );
}

const CARD_H = 60;

function stackHeight(n: number, expanded: boolean) {
  if (n === 0) return 0;
  if (expanded) return Math.min(n, 8) * (CARD_H + 8) - 8;
  return CARD_H + Math.min(n - 1, MAX_VISIBLE - 1) * 8;
}

function ToastCard({ item, index, expanded, onRemove, onTogglePause }: { item: ImportItem; index: number; expanded: boolean; onRemove: () => void; onTogglePause: () => void }) {
  const paused = item.pausedAt !== undefined;
  const collapsedY = -index * 8;
  const collapsedScale = 1 - index * 0.04;
  const expandedY = -index * (CARD_H + 8);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{
        opacity: expanded ? 1 : index === 0 ? 1 : Math.max(0.35, 1 - index * 0.25),
        y: expanded ? expandedY : collapsedY,
        scale: expanded ? 1 : collapsedScale,
      }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={spring.slow}
      style={{ zIndex: 20 - index, height: CARD_H, transformOrigin: "bottom center" }}
      className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 overflow-hidden rounded-lg bg-surface-5 px-2.5 shadow-surface-5"
    >
      <Thumb asset={item.asset} className="h-9 w-14 shrink-0 rounded-[4px]" dim={item.status !== "done"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="truncate">{item.asset.name}</span>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {item.status === "done" ? "Ready" : item.status === "queued" ? "Queued" : paused ? "Paused" : `${Math.round(item.progress * 100)}%`}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-7">
          <motion.div
            className={cn("h-full rounded-full", item.status === "done" ? "bg-foreground" : "bg-foreground/80")}
            animate={{ width: `${item.progress * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{fileSize(item.asset.size)}{item.status === "importing" ? ` · ~${Math.max(1, Math.round((item.durationMs * (1 - item.progress)) / 1000))}s left` : ""}</div>
      </div>
      <div className="flex shrink-0 items-center">
        {item.status === "importing" && (
          <button
            type="button"
            aria-label={paused ? "Resume" : "Pause"}
            onClick={onTogglePause}
            className="rounded p-1 text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
          >
            <HugeiconsIcon icon={paused ? PlayIcon : PauseIcon} size={12} strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          aria-label={item.status === "done" ? "Dismiss" : "Cancel import"}
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
        </button>
      </div>
    </motion.div>
  );
}
