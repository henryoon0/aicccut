"use client";

/**
 * Wizard — three calm screens: What (format & quality), Where (destination
 * & filename), Render (a big frame and one slow bar). Each screen slides in
 * from the right, back slides out to the left, under 300 ms.
 */

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Cloud, Copy, Download, FolderOpen, Link2, Share2, Upload, X } from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import { RadioGroup, RadioItem } from "#/components/ui/radio-group.tsx";
import { Slider } from "#/components/ui/slider.tsx";
import { Tabs, TabItem, TabsList } from "#/components/ui/tabs.tsx";
import { spring } from "#/lib/springs.ts";
import { fileSize, shortDuration, timecode } from "#/prototypes/mock";
import {
  DEFAULT_SETTINGS, EditorFrame, Field, FORMATS, FPS_CHOICES, FrameThumb, RESOLUTIONS,
  dimensions, estimateBytes, etaLabel, formatDef, fpsValue, qualityLabel, rangeSeconds, specLine, useRender,
  type ExportSettings, type FpsChoice, type Format, type Range, type Resolution,
} from "./shared";

type Step = 0 | 1 | 2;
type Destination = "download" | "drive" | "link";

const STEPS = ["What", "Where", "Render"] as const;
const DESTINATIONS: readonly { id: Destination; label: string; hint: string; icon: typeof Download }[] = [
  { id: "download", label: "Download", hint: "Save to this computer", icon: Download },
  { id: "drive", label: "Save to Drive", hint: "AI Coffee Chat / 강의 / 6화", icon: Cloud },
  { id: "link", label: "Copy link", hint: "Upload and share a private link", icon: Link2 },
];

export function WizardVariant() {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState(1);
  const [s, setS] = useState<ExportSettings>({ ...DEFAULT_SETTINGS, quality: 70 });
  const [dest, setDest] = useState<Destination>("download");
  const [name, setName] = useState("claude-code-ep6_hooks-and-agents");
  const { state, start, cancel, reset } = useRender();
  const patch = (p: Partial<ExportSettings>) => setS((prev) => ({ ...prev, ...p }));
  const audioOnly = formatDef(s.format).audioOnly;
  const busy = state.status === "rendering";

  const go = (next: Step) => { setDir(next > step ? 1 : -1); setStep(next); };
  const dismiss = () => { if (busy) return; setOpen(false); reset(); setStep(0); };
  const beginRender = () => { go(2); start(s); };
  const finalName = `${name}.${formatDef(s.format).ext}`;

  return (
    <EditorFrame dim={open} topRight={<Button size="compact" leadingIcon={Upload} onClick={() => setOpen(true)}>Export</Button>}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="wizard"
            role="dialog"
            aria-label="Export wizard"
            className="absolute left-1/2 top-1/2 z-20 flex h-[min(88%,500px)] w-[min(92%,640px)] flex-col overflow-hidden rounded-xl bg-surface-5 shadow-surface-5"
            initial={{ opacity: 0, scale: 0.97, x: "-50%", y: "-48%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
            exit={{ opacity: 0, scale: 0.97, x: "-50%", y: "-50%" }}
            transition={spring.slow}
          >
            <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-4">
              {STEPS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  disabled={busy || i > step}
                  onClick={() => go(i as Step)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                    i === step ? "text-foreground" : "text-muted-foreground",
                    i < step && !busy && "hover:bg-hover"
                  )}
                >
                  <span className={cn("grid size-5 place-items-center rounded-full text-[10px] font-medium tabular-nums", i < step ? "bg-emerald-500 text-white" : i === step ? "bg-foreground text-background" : "bg-surface-7 text-muted-foreground")}>
                    {i < step ? <Check size={11} strokeWidth={3} /> : i + 1}
                  </span>
                  {label}
                  {i < STEPS.length - 1 && <span className="ml-1 h-px w-6 bg-border" />}
                </button>
              ))}
              <Button variant="ghost" size="icon-compact" className="ml-auto" aria-label="Close" onClick={dismiss} disabled={busy}><X /></Button>
            </header>

            <div className="relative min-h-0 flex-1">
              <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                <motion.section
                  key={step}
                  custom={dir}
                  className="absolute inset-0 flex flex-col"
                  variants={{
                    enter: (d: number) => ({ x: d * 48, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (d: number) => ({ x: d * -48, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={spring.moderate}
                >
                  {step === 0 && (
                    <>
                      <div className="grid flex-1 grid-cols-2 gap-5 overflow-y-auto p-6">
                        <Field label="Format">
                          <RadioGroup value={s.format} onValueChange={(v) => patch({ format: v as Format })} size="compact">
                            {FORMATS.map((f, i) => <RadioItem key={f.id} index={i} value={f.id} label={f.label} />)}
                          </RadioGroup>
                        </Field>
                        <div className="grid gap-4">
                          <Field label="Resolution">
                            <Tabs value={s.resolution} onValueChange={(v) => patch({ resolution: v as Resolution })} size="compact" className={cn(audioOnly && "pointer-events-none opacity-40")}>
                              <TabsList className="w-full">{RESOLUTIONS.map((r) => <TabItem key={r.id} value={r.id} label={r.label} />)}</TabsList>
                            </Tabs>
                          </Field>
                          <Field label="Frame rate">
                            <Tabs value={s.fps} onValueChange={(v) => patch({ fps: v as FpsChoice })} size="compact" className={cn(audioOnly && "pointer-events-none opacity-40")}>
                              <TabsList className="w-full">{FPS_CHOICES.map((f) => <TabItem key={f.id} value={f.id} label={f.id === "source" ? "Source" : f.id} />)}</TabsList>
                            </Tabs>
                          </Field>
                          <Field label={`Quality · ${qualityLabel(s.quality)}`}>
                            <Slider value={s.quality} onChange={(v) => patch({ quality: v as number })} min={10} max={100} step={5} size="compact" showValue />
                          </Field>
                          <Field label="Range">
                            <Tabs value={s.range} onValueChange={(v) => patch({ range: v as Range })} size="compact">
                              <TabsList className="w-full"><TabItem value="whole" label="Whole" /><TabItem value="inout" label="In → out" /></TabsList>
                            </Tabs>
                          </Field>
                        </div>
                      </div>
                      <Footer left={<span>{specLine(s)} · ~{fileSize(estimateBytes(s))}</span>}>
                        <Button trailingIcon={ArrowRight} onClick={() => go(1)}>Next</Button>
                      </Footer>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <div className="grid flex-1 gap-5 overflow-y-auto p-6">
                        <Field label="Destination">
                          <div className="grid grid-cols-3 gap-2">
                            {DESTINATIONS.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                aria-pressed={dest === d.id}
                                onClick={() => setDest(d.id)}
                                className={cn(
                                  "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                                  dest === d.id ? "border-foreground/60 bg-selected" : "border-border bg-surface-4 hover:bg-hover"
                                )}
                              >
                                <d.icon size={18} strokeWidth={1.5} className={dest === d.id ? "text-foreground" : "text-muted-foreground"} />
                                <div>
                                  <div className="text-[13px] font-medium">{d.label}</div>
                                  <div className="text-[11px] text-muted-foreground">{d.hint}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </Field>
                        <Field label="File name">
                          <div className="flex items-center gap-2">
                            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 flex-1 bg-surface-3 text-[13px]" />
                            <span className="text-[12px] text-muted-foreground">.{formatDef(s.format).ext}</span>
                          </div>
                        </Field>
                        <div className="rounded-lg bg-surface-4 p-3 text-[12px]">
                          <div className="flex justify-between"><span className="text-muted-foreground">Output</span><span>{specLine(s)}</span></div>
                          <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Length</span><span className="tabular-nums">{shortDuration(rangeSeconds(s))}</span></div>
                          <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Estimated size</span><span className="tabular-nums">~{fileSize(estimateBytes(s))}</span></div>
                        </div>
                      </div>
                      <Footer left={<Button variant="ghost" leadingIcon={ArrowLeft} onClick={() => go(0)}>Back</Button>}>
                        <Button leadingIcon={Upload} onClick={beginRender} disabled={name.trim().length === 0}>Render</Button>
                      </Footer>
                    </>
                  )}

                  {step === 2 && (
                    <div className="flex flex-1 flex-col p-6">
                      <FrameThumb tint={state.tint} className="mx-auto w-full max-w-[520px] shadow-surface-4">
                        {!audioOnly && <span className="absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white">{timecode(state.time)}</span>}
                        {state.status === "done" && (
                          <motion.span className="absolute inset-0 grid place-items-center bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring.slow}>
                            <span className="grid size-12 place-items-center rounded-full bg-emerald-500 text-white"><Check size={24} strokeWidth={2.5} /></span>
                          </motion.span>
                        )}
                      </FrameThumb>
                      <div className="mx-auto mt-5 w-full max-w-[520px]">
                        {state.status === "done" ? (
                          <div className="flex flex-col items-center gap-3 text-center">
                            <div>
                              <div className="text-[15px] font-semibold">{finalName}</div>
                              <div className="mt-0.5 text-[12px] text-muted-foreground">
                                {fileSize(estimateBytes(s))} · {audioOnly ? formatDef(s.format).label : `${dimensions(s).width}×${dimensions(s).height} · ${fpsValue(s)} fps`}
                                {dest === "drive" && " · Saved to Drive"}{dest === "link" && " · Link ready"}
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2">
                              {dest === "link" ? <Button leadingIcon={Copy} onClick={dismiss}>Copy link</Button> : <Button leadingIcon={dest === "drive" ? FolderOpen : Download} onClick={dismiss}>{dest === "drive" ? "Open in Drive" : "Save"}</Button>}
                              <Button variant="secondary" leadingIcon={Share2}>Share</Button>
                              <Button variant="ghost" onClick={() => { reset(); go(0); }}>Export again</Button>
                            </div>
                          </div>
                        ) : state.status === "cancelled" ? (
                          <div className="flex flex-col items-center gap-3 text-center">
                            <div className="text-[13px] text-muted-foreground">Export cancelled at {Math.round(state.progress * 100)}%.</div>
                            <div className="flex gap-2">
                              <Button leadingIcon={Upload} onClick={() => start(s)}>Try again</Button>
                              <Button variant="ghost" onClick={() => go(1)}>Back</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-baseline justify-between">
                              <span className="text-[13px] font-medium">{finalName}</span>
                              <span className="text-[12px] tabular-nums text-muted-foreground">{etaLabel(state.eta)}</span>
                            </div>
                            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-7">
                              <div className="h-full rounded-full bg-foreground" style={{ width: `${state.progress * 100}%` }} />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                              <span>{Math.round(state.progress * 100)}% · frame {state.frame.toLocaleString()} of {state.totalFrames.toLocaleString()}</span>
                              <span>{state.fps} fps</span>
                            </div>
                            <div className="mt-5 flex justify-center">
                              <Button variant="secondary" leadingIcon={X} onClick={cancel}>Cancel</Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </motion.section>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </EditorFrame>
  );
}

function Footer({ left, children }: { left?: ReactNode; children: ReactNode }) {
  return (
    <footer className="flex h-14 shrink-0 items-center gap-3 border-t border-border px-4 text-[12px] text-muted-foreground">
      {left}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </footer>
  );
}
