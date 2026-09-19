"use client";

/**
 * Presets — destination first. A grid of platform cards, each already
 * showing the spec and size it would produce. "Custom" unfolds the detailed
 * form; rendering is a progress ring drawn on the chosen card itself.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, Download, FolderOpen, Share2, SlidersHorizontal, Upload, X } from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { Button } from "#/components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select.tsx";
import { Slider } from "#/components/ui/slider.tsx";
import { Switch } from "#/components/ui/switch.tsx";
import { Tabs, TabItem, TabsList } from "#/components/ui/tabs.tsx";
import { spring } from "#/lib/springs.ts";
import { fileSize } from "#/prototypes/mock";
import {
  DEFAULT_SETTINGS, EditorFrame, Field, FORMATS, FPS_CHOICES, FrameThumb, RESOLUTIONS,
  estimateBytes, etaLabel, fileName, formatDef, qualityLabel, specLine, useRender,
  type ExportSettings, type FpsChoice, type Format, type Resolution,
} from "./shared";

interface Preset {
  id: string;
  name: string;
  hint: string;
  settings: ExportSettings;
  aspect: "16:9" | "9:16" | "1:1" | "audio";
}

const PRESETS: readonly Preset[] = [
  { id: "yt4k", name: "YouTube 4K", hint: "Best for long-form", aspect: "16:9", settings: { format: "h264", resolution: "4k", fps: "source", quality: 85, range: "whole" } },
  { id: "yt1080", name: "YouTube 1080p", hint: "Fast upload", aspect: "16:9", settings: { format: "h264", resolution: "1080p", fps: "source", quality: 70, range: "whole" } },
  { id: "reels", name: "Instagram Reels", hint: "9:16 · 60 s cap", aspect: "9:16", settings: { format: "h264", resolution: "1080p", fps: "30", quality: 70, range: "inout", aspect: "9:16" } },
  { id: "threads", name: "Threads", hint: "9:16 · under 5 min", aspect: "9:16", settings: { format: "h265", resolution: "1080p", fps: "30", quality: 65, range: "inout", aspect: "9:16" } },
  { id: "x", name: "X", hint: "16:9 · 512 MB limit", aspect: "16:9", settings: { format: "h264", resolution: "720p", fps: "30", quality: 55, range: "inout" } },
  { id: "gif", name: "GIF", hint: "Silent loop", aspect: "16:9", settings: { format: "gif", resolution: "720p", fps: "source", quality: 40, range: "inout" } },
  { id: "audio", name: "Audio only", hint: "MP3 · voice + music", aspect: "audio", settings: { format: "mp3", resolution: "source", fps: "source", quality: 70, range: "whole" } },
];

export function PresetsVariant() {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<string>("yt1080");
  const [custom, setCustom] = useState<ExportSettings | null>(null);
  const { state, start, cancel, reset } = useRender();

  const activePreset = PRESETS.find((p) => p.id === picked);
  const settings = custom ?? activePreset?.settings ?? DEFAULT_SETTINGS;
  const busy = state.status === "rendering";

  const dismiss = () => {
    if (busy) return;
    setOpen(false);
    reset();
  };

  return (
    <EditorFrame dim={open} topRight={<Button size="compact" leadingIcon={Upload} onClick={() => setOpen(true)}>Export</Button>}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="sheet"
            className="absolute left-1/2 top-1/2 z-20 w-[min(92%,760px)] rounded-xl bg-surface-5 shadow-surface-5"
            initial={{ opacity: 0, scale: 0.97, y: "-48%", x: "-50%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
            exit={{ opacity: 0, scale: 0.97, x: "-50%", y: "-50%" }}
            transition={spring.slow}
            role="dialog"
            aria-label="Export"
          >
            <header className="flex items-center gap-3 border-b border-border px-5 py-3">
              {custom ? (
                <Button variant="ghost" size="compact" leadingIcon={ChevronLeft} onClick={() => setCustom(null)} disabled={busy}>Presets</Button>
              ) : (
                <span className="text-[14px] font-semibold">Where is this going?</span>
              )}
              <span className="ml-auto text-[12px] text-muted-foreground">{fileName(settings)}</span>
              <Button variant="ghost" size="icon-compact" aria-label="Close" onClick={dismiss} disabled={busy}><X /></Button>
            </header>

            <AnimatePresence mode="wait" initial={false}>
              {state.status === "done" ? (
                <motion.div key="done" className="flex items-center gap-5 p-6" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.slow}>
                  <FrameThumb tint={state.tint} className="w-[220px] shrink-0">
                    <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-emerald-500 text-white"><Check size={14} strokeWidth={2.5} /></span>
                  </FrameThumb>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">Ready for {custom ? "download" : activePreset?.name}</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">{specLine(settings)} · {fileSize(estimateBytes(settings))}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button leadingIcon={Download} onClick={dismiss}>Save</Button>
                      <Button variant="secondary" leadingIcon={FolderOpen}>Reveal</Button>
                      <Button variant="secondary" leadingIcon={Share2}>Share</Button>
                      <Button variant="ghost" onClick={reset}>Export again</Button>
                    </div>
                  </div>
                </motion.div>
              ) : custom ? (
                <CustomForm key="custom" settings={custom} onChange={setCustom} onExport={() => start(custom)} busy={busy} progress={state.progress} eta={state.eta} onCancel={cancel} />
              ) : (
                <motion.div key="grid" className="p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.moderate}>
                  <div className="grid grid-cols-4 gap-2.5">
                    {PRESETS.map((p) => (
                      <PresetCard
                        key={p.id}
                        preset={p}
                        selected={picked === p.id}
                        rendering={busy && picked === p.id}
                        progress={state.progress}
                        tint={state.tint}
                        disabled={busy && picked !== p.id}
                        onClick={() => !busy && setPicked(p.id)}
                      />
                    ))}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setCustom({ ...settings })}
                      className="flex flex-col items-start justify-between rounded-lg border border-dashed border-border p-3 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] disabled:opacity-40"
                    >
                      <SlidersHorizontal size={16} strokeWidth={1.5} className="text-muted-foreground" />
                      <div>
                        <div className="text-[13px] font-medium">Custom</div>
                        <div className="text-[11px] text-muted-foreground">Start from {activePreset?.name ?? "current"}</div>
                      </div>
                    </button>
                  </div>
                  <footer className="mt-5 flex items-center gap-3">
                    <div className="min-w-0 text-[12px] text-muted-foreground">
                      {busy ? (
                        <span className="tabular-nums">{Math.round(state.progress * 100)}% · {etaLabel(state.eta)} · {state.fps} fps</span>
                      ) : (
                        <span>{activePreset?.name} · {specLine(settings)}</span>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {state.status === "cancelled" && <span className="text-[12px] text-muted-foreground">Cancelled</span>}
                      {busy ? (
                        <Button variant="secondary" leadingIcon={X} onClick={cancel}>Cancel</Button>
                      ) : (
                        <Button leadingIcon={Upload} onClick={() => start(settings)}>Export · {fileSize(estimateBytes(settings))}</Button>
                      )}
                    </div>
                  </footer>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </EditorFrame>
  );
}

function PresetCard({ preset, selected, rendering, progress, tint, disabled, onClick }: {
  preset: Preset; selected: boolean; rendering: boolean; progress: number; tint: string; disabled: boolean; onClick: () => void;
}) {
  const size = estimateBytes(preset.settings);
  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
        selected ? "border-foreground/60 bg-selected" : "border-border bg-surface-4 hover:bg-hover",
        disabled && "opacity-40"
      )}
    >
      <div className="flex h-9 items-start justify-between">
        <AspectMark aspect={preset.aspect} tint={rendering ? tint : undefined} />
        {rendering ? (
          <svg width={36} height={36} viewBox="0 0 36 36" className="-mr-1 -mt-1">
            <circle cx={18} cy={18} r={R} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-surface-7" />
            <circle
              cx={18} cy={18} r={R} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 18 18)"
              className="text-foreground"
            />
            <text x={18} y={21} textAnchor="middle" className="fill-foreground font-mono text-[9px] tabular-nums">{Math.round(progress * 100)}</text>
          </svg>
        ) : selected ? (
          <span className="grid size-5 place-items-center rounded-full bg-foreground text-background"><Check size={12} strokeWidth={2.5} /></span>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium">{preset.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{preset.hint}</div>
      </div>
      <div className="mt-auto text-[11px] text-muted-foreground">
        <div className="truncate">{specLine(preset.settings).split(" · ").slice(0, 2).join(" · ")}</div>
        <div className="tabular-nums text-foreground">~{fileSize(size)}</div>
      </div>
    </button>
  );
}

function AspectMark({ aspect, tint }: { aspect: Preset["aspect"]; tint?: string }) {
  const dims = aspect === "9:16" ? "h-8 w-[18px]" : aspect === "1:1" ? "size-7" : aspect === "audio" ? "h-4 w-8" : "h-[18px] w-8";
  return (
    <span
      className={cn("block rounded-[3px] transition-colors duration-300", dims, aspect === "audio" && "rounded-full")}
      style={{ background: tint ?? "var(--muted-foreground)", opacity: tint ? 1 : 0.5 }}
    />
  );
}

function CustomForm({ settings, onChange, onExport, busy, progress, eta, onCancel }: {
  settings: ExportSettings; onChange: (s: ExportSettings) => void; onExport: () => void;
  busy: boolean; progress: number; eta: number; onCancel: () => void;
}) {
  const patch = (p: Partial<ExportSettings>) => onChange({ ...settings, ...p });
  const audioOnly = formatDef(settings.format).audioOnly;
  return (
    <motion.div className="p-5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={spring.moderate}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Format">
          <Select value={settings.format} onValueChange={(v) => patch({ format: v as Format })} disabled={busy}>
            <SelectTrigger className="w-full" />
            <SelectContent>{FORMATS.map((f, i) => <SelectItem key={f.id} index={i} value={f.id}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Frame rate">
          <Select value={settings.fps} onValueChange={(v) => patch({ fps: v as FpsChoice })} disabled={busy || audioOnly}>
            <SelectTrigger className="w-full" />
            <SelectContent>{FPS_CHOICES.map((f, i) => <SelectItem key={f.id} index={i} value={f.id}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Resolution" className="col-span-2">
          <Tabs value={settings.resolution} onValueChange={(v) => patch({ resolution: v as Resolution })} className={cn((busy || audioOnly) && "pointer-events-none opacity-40")}>
            <TabsList className="w-full">{RESOLUTIONS.map((r) => <TabItem key={r.id} value={r.id} label={`${r.label} · ${r.hint}`} />)}</TabsList>
          </Tabs>
        </Field>
        <Field label={`Quality · ${qualityLabel(settings.quality)}`} className="col-span-2">
          <Slider value={settings.quality} onChange={(v) => patch({ quality: v as number })} min={10} max={100} step={5} showValue disabled={busy} />
        </Field>
        <div className="col-span-2 flex items-center justify-between rounded-lg bg-surface-4 px-3 py-2">
          <div>
            <div className="text-[13px]">Export in → out only</div>
            <div className="text-[11px] text-muted-foreground">Uses the range marked on the timeline</div>
          </div>
          <Switch label="In to out" checked={settings.range === "inout"} onToggle={() => patch({ range: settings.range === "inout" ? "whole" : "inout" })} disabled={busy} size="compact" />
        </div>
      </div>
      <footer className="mt-5 flex items-center gap-3">
        <div className="text-[12px] text-muted-foreground tabular-nums">
          {busy ? `${Math.round(progress * 100)}% · ${etaLabel(eta)}` : specLine(settings)}
        </div>
        <div className="ml-auto">
          {busy ? <Button variant="secondary" leadingIcon={X} onClick={onCancel}>Cancel</Button>
            : <Button leadingIcon={Upload} onClick={onExport}>Export · {fileSize(estimateBytes(settings))}</Button>}
        </div>
      </footer>
      {busy && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-6">
          <div className="h-full bg-foreground" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </motion.div>
  );
}
