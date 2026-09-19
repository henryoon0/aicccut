"use client";

/**
 * Dialog — the classic modal: a settings form on the left, a live summary
 * card on the right. Rendering replaces the form in place; the done state
 * keeps the same footprint and swaps the footer for actions.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, FolderOpen, Share2, Upload, X } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog.tsx";
import { RadioGroup, RadioItem } from "#/components/ui/radio-group.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select.tsx";
import { Slider } from "#/components/ui/slider.tsx";
import { Tabs, TabItem, TabsList } from "#/components/ui/tabs.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { spring } from "#/lib/springs.ts";
import { fileSize, shortDuration, timecode } from "#/prototypes/mock";
import {
  DEFAULT_SETTINGS, EditorFrame, Field, FORMATS, FPS_CHOICES, FrameThumb, IN_POINT, OUT_POINT, ProgressBar, RESOLUTIONS,
  dimensions, estimateBytes, etaLabel, fileName, formatDef, fpsValue, qualityLabel, rangeSeconds, useRender,
  type ExportSettings, type FpsChoice, type Format, type Range, type Resolution,
} from "./shared";

export function DialogVariant() {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(true);
  const [s, setS] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const { state, start, cancel, reset } = useRender();
  const patch = (p: Partial<ExportSettings>) => setS((prev) => ({ ...prev, ...p }));
  const audioOnly = formatDef(s.format).audioOnly;
  const bytes = estimateBytes(s);

  const close = (next: boolean) => {
    if (!next && state.status === "rendering") return; // cancel first
    setOpen(next);
    if (!next) reset();
  };

  return (
    <EditorFrame
      frameRef={setFrame}
      topRight={<Button size="compact" leadingIcon={Upload} onClick={() => setOpen(true)}>Export</Button>}
    >
      {frame && (
        <Dialog open={open} onOpenChange={close} modal={false}>
          <DialogContent container={frame} size="xl" className="p-0" showCloseButton={state.status !== "rendering"} aria-describedby={undefined}>
            <AnimatePresence mode="wait" initial={false}>
              {state.status === "idle" || state.status === "cancelled" ? (
                <motion.div key="form" className="grid grid-cols-[1fr_280px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.moderate}>
                  <div className="p-6">
                    <DialogHeader>
                      <DialogTitle>Export</DialogTitle>
                      <DialogDescription>Choose a format and quality. The estimate on the right updates as you go.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Format">
                          <Select value={s.format} onValueChange={(v) => patch({ format: v as Format })}>
                            <SelectTrigger className="w-full" />
                            <SelectContent>
                              {FORMATS.map((f, i) => <SelectItem key={f.id} index={i} value={f.id}>{f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Frame rate">
                          <Select value={s.fps} onValueChange={(v) => patch({ fps: v as FpsChoice })} disabled={audioOnly}>
                            <SelectTrigger className="w-full" />
                            <SelectContent>
                              {FPS_CHOICES.map((f, i) => <SelectItem key={f.id} index={i} value={f.id}>{f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      <Field label="Resolution">
                        <Tabs value={s.resolution} onValueChange={(v) => patch({ resolution: v as Resolution })} className={audioOnly ? "pointer-events-none opacity-40" : undefined}>
                          <TabsList className="w-full">
                            {RESOLUTIONS.map((r) => <TabItem key={r.id} value={r.id} label={r.label} />)}
                          </TabsList>
                        </Tabs>
                      </Field>
                      <Field label={`Quality · ${qualityLabel(s.quality)}`}>
                        <Slider value={s.quality} onChange={(v) => patch({ quality: v as number })} min={10} max={100} step={5} showValue formatValue={(v) => `${v}`} />
                      </Field>
                      <Field label="Range">
                        <RadioGroup value={s.range} onValueChange={(v) => patch({ range: v as Range })} size="compact">
                          <RadioItem index={0} value="whole" label={`Whole timeline · ${shortDuration(rangeSeconds({ ...s, range: "whole" }))}`} />
                          <RadioItem index={1} value="inout" label={`In to out · ${timecode(IN_POINT).slice(3)} → ${timecode(OUT_POINT).slice(3)}`} />
                        </RadioGroup>
                      </Field>
                    </div>
                    <div className="mt-6 flex items-center justify-end gap-2">
                      {state.status === "cancelled" && <span className="mr-auto text-[12px] text-muted-foreground">Export cancelled.</span>}
                      <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
                      <Button leadingIcon={Upload} onClick={() => start(s)}>Export</Button>
                    </div>
                  </div>
                  <aside className="flex flex-col gap-4 rounded-r-xl border-l border-border bg-surface-3 p-5">
                    <FrameThumb tint={state.tint} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">{fileName(s)}</div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        {audioOnly ? formatDef(s.format).label : `${dimensions(s).width}×${dimensions(s).height} · ${fpsValue(s)} fps`}
                      </div>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
                      <dt className="text-muted-foreground">Codec</dt><dd className="text-right">{formatDef(s.format).label.split(" · ").at(-1)}</dd>
                      <dt className="text-muted-foreground">Duration</dt><dd className="text-right tabular-nums">{shortDuration(rangeSeconds(s))}</dd>
                      <dt className="text-muted-foreground">Quality</dt><dd className="text-right">{qualityLabel(s.quality)} · {s.quality}</dd>
                    </dl>
                    <div className="mt-auto border-t border-border pt-4">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimated size</div>
                      <motion.div key={Math.round(bytes / 1e6)} className="text-[22px] font-semibold tabular-nums" initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={spring.fast}>
                        ~{fileSize(bytes)}
                      </motion.div>
                    </div>
                  </aside>
                </motion.div>
              ) : state.status === "rendering" ? (
                <motion.div key="render" className="grid grid-cols-[1fr_280px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.moderate}>
                  <div className="flex flex-col p-6">
                    <DialogHeader>
                      <DialogTitle>Exporting…</DialogTitle>
                      <DialogDescription>{fileName(s)} · {etaLabel(state.eta)}</DialogDescription>
                    </DialogHeader>
                    <FrameThumb tint={state.tint} className="w-full">
                      <span className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white">{timecode(state.time)}</span>
                    </FrameThumb>
                    <div className="mt-5 flex items-center justify-between text-[12px] text-muted-foreground">
                      <span className="tabular-nums">Frame {state.frame.toLocaleString()} / {state.totalFrames.toLocaleString()}</span>
                      <span className="tabular-nums">{state.fps} fps</span>
                    </div>
                    <ProgressBar value={state.progress} className="mt-2" />
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-[20px] font-semibold tabular-nums">{Math.round(state.progress * 100)}%</span>
                      <Button variant="secondary" leadingIcon={X} onClick={cancel}>Cancel</Button>
                    </div>
                  </div>
                  <aside className="flex flex-col gap-3 rounded-r-xl border-l border-border bg-surface-3 p-5 text-[12px]">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Settings</div>
                    <Row k="Format" v={formatDef(s.format).label} />
                    <Row k="Resolution" v={audioOnly ? "—" : `${dimensions(s).width}×${dimensions(s).height}`} />
                    <Row k="Frame rate" v={audioOnly ? "—" : `${fpsValue(s)} fps`} />
                    <Row k="Quality" v={qualityLabel(s.quality)} />
                    <Row k="Range" v={s.range === "whole" ? "Whole" : "In → out"} />
                    <div className="mt-auto border-t border-border pt-4">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimated size</div>
                      <div className="text-[22px] font-semibold tabular-nums">~{fileSize(bytes)}</div>
                    </div>
                  </aside>
                </motion.div>
              ) : (
                <motion.div key="done" className="p-6" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring.slow}>
                  <div className="flex items-start gap-4">
                    <FrameThumb tint={state.tint} className="w-[240px] shrink-0">
                      <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-emerald-500 text-white"><Check size={14} strokeWidth={2.5} /></span>
                    </FrameThumb>
                    <div className="min-w-0 flex-1">
                      <DialogTitle>Export complete</DialogTitle>
                      <div className="mt-1 truncate text-[13px] text-muted-foreground">{fileName(s)}</div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge color="gray">{fileSize(bytes)}</Badge>
                        {!audioOnly && <Badge color="gray">{dimensions(s).width}×{dimensions(s).height}</Badge>}
                        {!audioOnly && <Badge color="gray">{fpsValue(s)} fps</Badge>}
                        <Badge color="gray">{shortDuration(rangeSeconds(s))}</Badge>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button leadingIcon={Download} onClick={() => close(false)}>Save</Button>
                        <Button variant="secondary" leadingIcon={FolderOpen}>Reveal</Button>
                        <Button variant="secondary" leadingIcon={Share2}>Share</Button>
                        <Button variant="ghost" onClick={reset}>Export again</Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </DialogContent>
        </Dialog>
      )}
    </EditorFrame>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
