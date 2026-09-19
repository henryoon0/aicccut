"use client";

/**
 * Panel — a non-modal export drawer on the right. The editor stays usable
 * while a queue of exports renders one after another, each with its own
 * progress row. Add "1080p" and "Reels 9:16" and watch them go in order.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, FolderOpen, ListPlus, PanelRightClose, Plus, Trash2, Upload, X } from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { Button } from "#/components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select.tsx";
import { Slider } from "#/components/ui/slider.tsx";
import { Switch } from "#/components/ui/switch.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { spring } from "#/lib/springs.ts";
import { fileSize } from "#/prototypes/mock";
import {
  DEFAULT_SETTINGS, EditorFrame, Field, FORMATS, FrameThumb, IN_POINT, RESOLUTIONS,
  estimateBytes, etaLabel, fileName, formatDef, fpsValue, qualityLabel, rangeSeconds, renderDurationMs, specLine, tintAt,
  type ExportSettings, type Format, type Resolution,
} from "./shared";

type JobStatus = "queued" | "rendering" | "done" | "cancelled";

interface Job {
  id: number;
  label: string;
  settings: ExportSettings;
  status: JobStatus;
  progress: number;
  eta: number;
  fps: number;
  tint: string;
}

const QUICK: readonly { label: string; settings: ExportSettings }[] = [
  { label: "1080p", settings: { ...DEFAULT_SETTINGS, resolution: "1080p", quality: 70 } },
  { label: "Reels 9:16", settings: { ...DEFAULT_SETTINGS, resolution: "1080p", fps: "30", quality: 70, range: "inout", aspect: "9:16" } },
  { label: "4K", settings: { ...DEFAULT_SETTINGS, resolution: "4k", quality: 85 } },
  { label: "Audio", settings: { ...DEFAULT_SETTINGS, format: "mp3", quality: 70 } },
];

/** Sequential render queue: one job renders at a time, driven by rAF. */
function useQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const raf = useRef<number | null>(null);
  const runningId = useRef<number | null>(null);
  const nextId = useRef(1);

  const add = useCallback((label: string, settings: ExportSettings) => {
    setJobs((prev) => [...prev, {
      id: nextId.current++, label, settings, status: "queued", progress: 0,
      eta: renderDurationMs(settings) / 1000, fps: 0, tint: tintAt(settings.range === "inout" ? IN_POINT : 0),
    }]);
  }, []);

  const cancel = useCallback((id: number) => {
    if (runningId.current === id && raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
      runningId.current = null;
    }
    setJobs((prev) => prev.map((j) => (j.id === id && j.status !== "done" ? { ...j, status: "cancelled" } : j)));
  }, []);

  const remove = useCallback((id: number) => setJobs((prev) => prev.filter((j) => j.id !== id)), []);

  // Kick the next queued job whenever nothing is rendering.
  useEffect(() => {
    if (runningId.current !== null) return;
    const next = jobs.find((j) => j.status === "queued");
    if (!next) return;
    runningId.current = next.id;
    const id = next.id;
    const s = next.settings;
    const durationMs = renderDurationMs(s);
    const seconds = rangeSeconds(s);
    const offset = s.range === "inout" ? IN_POINT : 0;
    const totalFrames = seconds * fpsValue(s);
    let t0: number | null = null;
    const tick = (now: number) => {
      if (t0 === null) t0 = now;
      const p = Math.min(1, (now - t0) / durationMs);
      const elapsed = (now - t0) / 1000;
      setJobs((prev) => prev.map((j) => j.id === id ? {
        ...j,
        status: p >= 1 ? "done" : "rendering",
        progress: p,
        eta: Math.max(0, durationMs / 1000 - elapsed),
        fps: elapsed > 0.2 ? Math.round((p * totalFrames) / elapsed) : 0,
        tint: tintAt(offset + p * seconds),
      } : j));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { raf.current = null; runningId.current = null; }
    };
    raf.current = requestAnimationFrame(tick);
  }, [jobs]);

  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);

  return { jobs, add, cancel, remove };
}

export function PanelVariant() {
  const [open, setOpen] = useState(true);
  const [s, setS] = useState<ExportSettings>({ ...DEFAULT_SETTINGS, resolution: "1080p" });
  const { jobs, add, cancel, remove } = useQueue();
  const patch = (p: Partial<ExportSettings>) => setS((prev) => ({ ...prev, ...p }));
  const audioOnly = formatDef(s.format).audioOnly;
  const active = jobs.filter((j) => j.status === "rendering" || j.status === "queued").length;

  return (
    <EditorFrame
      topRight={
        <Button size="compact" variant={open ? "secondary" : "primary"} leadingIcon={Upload} active={open} onClick={() => setOpen((o) => !o)}>
          Export{active > 0 && <Badge size="compact" color="blue" className="ml-1">{active}</Badge>}
        </Button>
      }
      aside={
        <AnimatePresence initial={false}>
          {open && (
            <motion.aside
              key="panel"
              className="flex w-[340px] shrink-0 flex-col border-l border-border bg-surface-3"
              initial={{ x: 340, opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0.6 }}
              transition={spring.moderate}
            >
              <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
                <span className="text-[13px] font-semibold">Export</span>
                <span className="text-[11px] text-muted-foreground">Editor stays live</span>
                <Tooltip content="Close panel" side="bottom">
                  <Button variant="ghost" size="icon-compact" className="ml-auto" aria-label="Close panel" onClick={() => setOpen(false)}><PanelRightClose /></Button>
                </Tooltip>
              </header>

              <div className="grid gap-3 border-b border-border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Format">
                    <Select value={s.format} onValueChange={(v) => patch({ format: v as Format })} size="compact">
                      <SelectTrigger className="w-full" />
                      <SelectContent>{FORMATS.map((f, i) => <SelectItem key={f.id} index={i} value={f.id}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Resolution">
                    <Select value={s.resolution} onValueChange={(v) => patch({ resolution: v as Resolution })} size="compact" disabled={audioOnly}>
                      <SelectTrigger className="w-full" />
                      <SelectContent>{RESOLUTIONS.map((r, i) => <SelectItem key={r.id} index={i} value={r.id}>{r.label} · {r.hint}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label={`Quality · ${qualityLabel(s.quality)}`}>
                  <Slider value={s.quality} onChange={(v) => patch({ quality: v as number })} min={10} max={100} step={5} size="compact" showValue />
                </Field>
                <Switch label="In → out only" checked={s.range === "inout"} onToggle={() => patch({ range: s.range === "inout" ? "whole" : "inout" })} size="compact" />
                <div className="flex items-center justify-between rounded-md bg-surface-4 px-2.5 py-2 text-[12px]">
                  <span className="truncate text-muted-foreground">{specLine(s)}</span>
                  <span className="ml-2 shrink-0 tabular-nums">~{fileSize(estimateBytes(s))}</span>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" size="compact" leadingIcon={ListPlus} onClick={() => add(audioOnly ? "Audio" : RESOLUTIONS.find((r) => r.id === s.resolution)?.label ?? "Custom", s)}>
                    Add to queue
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => add(q.label, q.settings)}
                      className="inline-flex h-6 items-center gap-1 rounded-full border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                    >
                      <Plus size={11} strokeWidth={2} />{q.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between px-3 pt-3 text-[11px] font-medium text-muted-foreground">
                  <span>Queue · {jobs.length}</span>
                  {active > 0 && <span className="tabular-nums">{active} pending</span>}
                </div>
                <ul className="flex-1 space-y-2 overflow-y-auto p-3">
                  <AnimatePresence initial={false}>
                    {jobs.length === 0 && (
                      <motion.li key="empty" className="rounded-md border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        Nothing queued. Add a version above; they render one after another.
                      </motion.li>
                    )}
                    {jobs.map((j) => <JobRow key={j.id} job={j} onCancel={() => cancel(j.id)} onRemove={() => remove(j.id)} />)}
                  </AnimatePresence>
                </ul>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      }
    />
  );
}

function JobRow({ job, onCancel, onRemove }: { job: Job; onCancel: () => void; onRemove: () => void }) {
  const size = estimateBytes(job.settings);
  return (
    <motion.li
      layout
      className={cn("rounded-lg border border-border bg-surface-4 p-2.5", job.status === "cancelled" && "opacity-60")}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={spring.moderate}
    >
      <div className="flex items-start gap-2.5">
        <FrameThumb tint={job.tint} className="w-14 shrink-0">
          {job.status === "done" && <span className="absolute inset-0 grid place-items-center bg-black/30 text-white"><Check size={14} strokeWidth={2.5} /></span>}
        </FrameThumb>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-medium">{job.label}</span>
            <span className="truncate text-[11px] text-muted-foreground">{fileName(job.settings)}</span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{specLine(job.settings)} · ~{fileSize(size)}</div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
            {job.status === "queued" && <span>Waiting</span>}
            {job.status === "rendering" && <span>{Math.round(job.progress * 100)}% · {etaLabel(job.eta)} · {job.fps} fps</span>}
            {job.status === "done" && <span className="text-emerald-500">Done · {fileSize(size)}</span>}
            {job.status === "cancelled" && <span>Cancelled</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {job.status === "done" ? (
            <>
              <Tooltip content="Save" side="bottom"><Button variant="ghost" size="icon-compact" aria-label="Save"><Download /></Button></Tooltip>
              <Tooltip content="Reveal" side="bottom"><Button variant="ghost" size="icon-compact" aria-label="Reveal"><FolderOpen /></Button></Tooltip>
            </>
          ) : job.status === "cancelled" ? (
            <Tooltip content="Remove" side="bottom"><Button variant="ghost" size="icon-compact" aria-label="Remove" onClick={onRemove}><Trash2 /></Button></Tooltip>
          ) : (
            <Tooltip content="Cancel" side="bottom"><Button variant="ghost" size="icon-compact" aria-label="Cancel" onClick={onCancel}><X /></Button></Tooltip>
          )}
        </div>
      </div>
      {(job.status === "rendering" || job.status === "queued") && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-6">
          <div className="h-full rounded-full bg-foreground" style={{ width: `${job.progress * 100}%` }} />
        </div>
      )}
    </motion.li>
  );
}
