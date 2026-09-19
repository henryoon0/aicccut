/**
 * Sheet — import is a decision, so it gets a room. Picking or dropping files
 * opens a Dialog that lists them with size, duration and resolution, offers
 * "Create proxies" and "Add to timeline", shows per-file progress, then Done.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Cancel01Icon, FileUploadIcon } from "@hugeicons/core-free-icons";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx";
import { Switch } from "#/components/ui/switch.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table.tsx";
import { spring } from "#/lib/springs.ts";
import { cn } from "#/lib/utils.ts";
import { ASSETS, fileSize, shortDuration, timecode, type Asset, type Clip } from "#/prototypes/mock";
import {
  EditorFrame,
  KindIcon,
  Thumb,
  pickAssets,
  useDropTarget,
  useFilePicker,
  useImportQueue,
  usePasteImport,
  asIcon,
} from "./shared";

const ImportIcon = asIcon(FileUploadIcon);

type Phase = "closed" | "review" | "importing" | "done";

export function Sheet() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [staged, setStaged] = useState<Asset[]>([]);
  const [proxies, setProxies] = useState(true);
  const [toTimeline, setToTimeline] = useState(false);
  const [extraClips, setExtraClips] = useState<Clip[]>([]);
  const q = useImportQueue({ initialLibrary: ASSETS.slice(0, 4), concurrency: 2 });

  const stage = (n: number) => {
    setStaged(pickAssets(n, [...q.library, ...staged]));
    setPhase("review");
  };
  const { over, bind } = useDropTarget((n) => stage(n));
  const picker = useFilePicker(stage);
  usePasteImport(() => stage(1));

  const batch = q.items.filter((i) => staged.some((s) => s.id === i.asset.id));
  const allDone = batch.length > 0 && batch.every((i) => i.status === "done");
  useEffect(() => {
    if (phase !== "importing" || !allDone) return;
    setPhase("done");
    if (!toTimeline) return;
    let cursor = 98;
    setExtraClips(
      staged
        .filter((a) => a.kind !== "audio")
        .map((a) => {
          const d = a.kind === "image" ? 5 : Math.min(a.duration, 14);
          const c: Clip = { id: `x-${a.id}`, trackId: "t-v1", assetId: a.id, label: a.name.replace(/\.\w+$/, ""), start: cursor, duration: d, inPoint: 0, tint: a.tint };
          cursor += d;
          return c;
        }),
    );
  }, [phase, allDone, toTimeline, staged]);

  const begin = () => {
    q.enqueue(staged);
    setPhase("importing");
  };
  const close = () => {
    setPhase("closed");
    setStaged([]);
    q.clearDone();
  };
  const removeStaged = (id: string) => setStaged((s) => s.filter((a) => a.id !== id));
  const totalBytes = staged.reduce((n, a) => n + a.size, 0);
  const overall = batch.length ? batch.reduce((n, i) => n + i.progress, 0) / batch.length : 0;

  return (
    <EditorFrame
      extraClips={extraClips}
      topbar={
        <Button variant="secondary" size="compact" leadingIcon={ImportIcon} onClick={picker.open}>
          Import…
        </Button>
      }
      media={
        <div className="flex min-h-0 flex-1 flex-col" {...bind}>
          {picker.input}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-[12px]">
            <span className="font-medium">Media <span className="text-muted-foreground">· {q.library.length}</span></span>
            <span className="text-[11px] text-muted-foreground">⌘I</span>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-2 transition-colors", over && "bg-selected")}>
            {q.library.map((a) => (
              <div key={a.id} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-hover">
                <Thumb asset={a} className="h-9 w-14 shrink-0 rounded-[4px]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px]">{a.name}</div>
                  <div className="text-[10.5px] text-muted-foreground">{a.duration ? shortDuration(a.duration) : `${a.width}×${a.height}`} · {fileSize(a.size)}</div>
                </div>
                <span className="text-muted-foreground"><KindIcon kind={a.kind} size={13} /></span>
              </div>
            ))}
            <div className={cn("mt-2 rounded-md border border-dashed p-3 text-center text-[11px] transition-colors", over ? "border-foreground/60 text-foreground" : "border-border text-muted-foreground")}>
              {over ? "Release to review files" : "Drop files here to review before importing"}
            </div>
          </div>
        </div>
      }
    >
      <Dialog open={phase !== "closed"} onOpenChange={(o) => { if (!o && phase !== "importing") close(); }}>
        <DialogContent size="xl" showCloseButton={phase !== "importing"} className="p-0" onEscapeKeyDown={(e) => phase === "importing" && e.preventDefault()}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>
              {phase === "review" && `Import ${staged.length} file${staged.length > 1 ? "s" : ""}`}
              {phase === "importing" && `Importing… ${Math.round(overall * 100)}%`}
              {phase === "done" && "Import complete"}
            </DialogTitle>
            <DialogDescription>
              {phase === "review" && `${fileSize(totalBytes)} total · files are linked, not copied.`}
              {phase === "importing" && "You can keep editing. Proxies render in the background."}
              {phase === "done" && `${staged.length} items added to Media${toTimeline ? " and the timeline" : ""}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[46dvh] overflow-y-auto border-y border-border">
            <Table size="compact">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44%]">File</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead className="w-[140px] text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staged.map((a) => {
                  const it = batch.find((b) => b.asset.id === a.id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Thumb asset={a} className="h-6 w-10 shrink-0 rounded-[3px]" />
                          <span className="truncate">{a.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{fileSize(a.size)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{a.duration ? timecode(a.duration).slice(0, 8) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.width ? `${a.width}×${a.height}${a.fps ? ` @${a.fps}` : ""}` : `${Math.round((a.size * 8) / a.duration / 1000)} kbps`}</TableCell>
                      <TableCell className="text-right">
                        {phase === "review" && (
                          <button type="button" aria-label={`Remove ${a.name}`} onClick={() => removeStaged(a.id)} className="rounded p-1 text-muted-foreground hover:bg-hover hover:text-foreground">
                            <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
                          </button>
                        )}
                        {phase !== "review" && it && (
                          it.status === "done" ? (
                            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={spring.moderate} className="inline-flex">
                              <Badge color="green" size="compact" variant="dot">Ready</Badge>
                            </motion.span>
                          ) : it.status === "queued" ? (
                            <Badge size="compact">Queued</Badge>
                          ) : (
                            <div className="ml-auto flex w-[120px] items-center gap-2">
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-5">
                                <div className="h-full bg-foreground transition-[width] duration-100" style={{ width: `${it.progress * 100}%` }} />
                              </div>
                              <span className="w-8 text-right font-mono text-[10.5px] tabular-nums">{Math.round(it.progress * 100)}%</span>
                            </div>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
            <Switch label="Create proxies" checked={proxies} onToggle={() => setProxies((v) => !v)} size="compact" disabled={phase !== "review"} />
            <Switch label="Add to timeline at end" checked={toTimeline} onToggle={() => setToTimeline((v) => !v)} size="compact" disabled={phase !== "review"} />
            <span className="ml-auto text-[11px] text-muted-foreground">
              {proxies ? "Proxies: 1080p H.264, ~" + fileSize(totalBytes * 0.18) : "Proxies off"}
            </span>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <AnimatePresence mode="wait" initial={false}>
              {phase === "review" && (
                <motion.div key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.fast} className="flex gap-2">
                  <Button variant="tertiary" onClick={close}>Cancel</Button>
                  <Button variant="primary" onClick={begin} disabled={staged.length === 0}>
                    Import {staged.length}
                  </Button>
                </motion.div>
              )}
              {phase === "importing" && (
                <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.fast} className="flex gap-2">
                  <Button variant="tertiary" onClick={() => setPhase("closed")}>Continue in background</Button>
                  <Button variant="primary" loading>Importing</Button>
                </motion.div>
              )}
              {phase === "done" && (
                <motion.div key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.fast} className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={1.75} /> All files ready
                  </span>
                  <Button variant="primary" autoFocus onClick={close}>Done</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EditorFrame>
  );
}
