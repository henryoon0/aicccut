"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { Button } from "#/components/ui/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx";
import { InputField, InputGroup } from "#/components/ui/input-group.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select.tsx";
import {
  AspectFrame,
  CreatedNotice,
  DEFAULT_DRAFT,
  FPS_OPTIONS,
  HomeBackdrop,
  RESOLUTIONS,
  isFps,
  isResolution,
  summaryLine,
  useCreateFlow,
  type Aspect,
  type Draft,
  type Fps,
  type Resolution,
} from "./shared";

interface Preset {
  id: string;
  title: string;
  sub: string;
  aspect: Aspect;
  fps: Fps;
  resolution: Resolution;
  tint: string;
}

const PRESETS: readonly Preset[] = [
  { id: "youtube", title: "YouTube", sub: "16:9 · 1080p · 30", aspect: "16:9", fps: 30, resolution: "1080p", tint: "#ff4d4d" },
  { id: "reels", title: "Reels / Shorts", sub: "9:16 · 1080p · 30", aspect: "9:16", fps: 30, resolution: "1080p", tint: "#c77dff" },
  { id: "square", title: "Square post", sub: "1:1 · 1080p · 30", aspect: "1:1", fps: 30, resolution: "1080p", tint: "#2ec4b6" },
  { id: "portrait", title: "Portrait 4:5", sub: "4:5 · 1080p · 30", aspect: "4:5", fps: 30, resolution: "1080p", tint: "#f4a261" },
  { id: "custom", title: "Custom", sub: "Set every value", aspect: "16:9", fps: 30, resolution: "custom", tint: "#8d99ae" },
];

/**
 * Presets — the platform decides the format, you decide the name. The form
 * is still there for the 1 in 10 case, folded under "Advanced".
 */
export function Presets() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(true);
  const [presetId, setPresetId] = useState<string>("youtube");
  const [draft, setDraft] = useState<Draft>({ ...DEFAULT_DRAFT });
  const [advanced, setAdvanced] = useState(false);
  const [touched, setTouched] = useState(false);
  const { status, create, reset } = useCreateFlow();

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const nameError = touched && draft.name.trim() === "" ? "Give the project a name." : undefined;
  const isCustom = presetId === "custom";
  const showAdvanced = advanced || isCustom;

  const pick = (p: Preset) => {
    setPresetId(p.id);
    patch({ aspect: p.aspect, fps: p.fps, resolution: p.resolution });
    if (p.id === "custom") setAdvanced(true);
  };

  const submit = () => {
    setTouched(true);
    if (draft.name.trim() === "") return;
    create();
  };
  const startOver = () => {
    reset();
    setDraft({ ...DEFAULT_DRAFT });
    setPresetId("youtube");
    setAdvanced(false);
    setTouched(false);
  };

  return (
    <div ref={setContainer} className="relative h-full w-full overflow-hidden">
      <HomeBackdrop dim={open} onNew={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogContent
          container={container}
          size="xl"
          className="max-w-[720px]"
          onInteractOutside={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && status === "idle" && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              submit();
            }
          }}
        >
          {status === "created" ? (
            <CreatedNotice draft={draft} onReset={startOver} className="py-8" />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
                <DialogDescription>Start from where it will be posted.</DialogDescription>
              </DialogHeader>

              <div role="radiogroup" aria-label="Preset" className="grid grid-cols-5 gap-2.5">
                {PRESETS.map((p) => {
                  const selected = p.id === presetId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => pick(p)}
                      className={cn(
                        "group flex flex-col gap-2 rounded-lg border p-2 text-left outline-none transition-[border-color,background-color,transform] duration-100",
                        "focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985]",
                        selected ? "border-foreground/70 bg-selected/30" : "border-border hover:bg-hover"
                      )}
                    >
                      <div
                        className="grid aspect-[4/5] w-full place-items-center rounded-md"
                        style={{ background: `linear-gradient(160deg, ${p.tint}55, ${p.tint}11)` }}
                      >
                        {p.id === "custom" ? (
                          <div className="relative grid size-14 place-items-center">
                            <AspectFrame aspect="16:9" size={44} className="absolute text-foreground/40 [border-style:dashed]" />
                            <AspectFrame aspect="9:16" size={44} className="absolute text-foreground/40 [border-style:dashed]" />
                          </div>
                        ) : (
                          <AspectFrame
                            aspect={p.aspect}
                            size={56}
                            className={cn(
                              "transition-colors duration-100",
                              selected ? "bg-foreground/10 text-foreground" : "text-foreground/60 group-hover:text-foreground"
                            )}
                          />
                        )}
                      </div>
                      <div className="px-0.5 pb-0.5">
                        <p className={cn("text-[12px] leading-tight", selected ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>{p.title}</p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{p.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-end gap-3">
                <InputGroup className="flex-1">
                  <InputField
                    label="Name"
                    index={0}
                    placeholder="e.g. 수강생 후기 모음 v3"
                    value={draft.name}
                    onChange={(v) => patch({ name: v })}
                    onBlur={() => setTouched(true)}
                    error={nameError}
                    autoFocus
                  />
                </InputGroup>
                <p className="mb-2 shrink-0 text-[12px] tabular-nums text-muted-foreground">{summaryLine(draft)}</p>
              </div>

              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                disabled={isCustom}
                className={cn(
                  "mt-3 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-muted-foreground outline-none transition-colors duration-100",
                  "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60"
                )}
              >
                <ChevronDown
                  size={14}
                  className={cn("transition-transform duration-150 ease-out", showAdvanced && "rotate-180")}
                />
                Advanced
              </button>

              {/* 0fr→1fr grid reveal: cheap, no layout thrash, motion-reduce safe */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
                  showAdvanced ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
                aria-hidden={!showAdvanced}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-muted-foreground">Aspect ratio</span>
                      <Select
                        value={draft.aspect}
                        onValueChange={(v) => patch({ aspect: v as Aspect })}
                        disabled={!showAdvanced}
                      >
                        <SelectTrigger />
                        <SelectContent>
                          {(["16:9", "9:16", "1:1", "4:5"] as Aspect[]).map((a, i) => (
                            <SelectItem key={a} value={a} index={i}>
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-muted-foreground">Frame rate</span>
                      <Select
                        value={String(draft.fps)}
                        onValueChange={(v) => {
                          const n = Number(v);
                          if (isFps(n)) patch({ fps: n });
                        }}
                        disabled={!showAdvanced}
                      >
                        <SelectTrigger />
                        <SelectContent>
                          {FPS_OPTIONS.map((o, i) => (
                            <SelectItem key={o.value} value={String(o.value)} index={i}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-medium text-muted-foreground">Resolution</span>
                      <Select
                        value={draft.resolution}
                        onValueChange={(v) => {
                          if (isResolution(v)) patch({ resolution: v });
                        }}
                        disabled={!showAdvanced}
                      >
                        <SelectTrigger />
                        <SelectContent>
                          {RESOLUTIONS.map((o, i) => (
                            <SelectItem key={o.value} value={o.value} index={i}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  {draft.resolution === "custom" && (
                    <InputGroup size="compact" className="mt-3 max-w-[320px]">
                      <InputField
                        label="Width"
                        index={0}
                        inputMode="numeric"
                        value={String(draft.customWidth)}
                        onChange={(v) => patch({ customWidth: Math.max(16, Number(v.replace(/\D/g, "")) || 0) })}
                      />
                      <InputField
                        label="Height"
                        index={1}
                        inputMode="numeric"
                        value={String(draft.customHeight)}
                        onChange={(v) => patch({ customHeight: Math.max(16, Number(v.replace(/\D/g, "")) || 0) })}
                      />
                    </InputGroup>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <DialogClose render={<Button variant="secondary">Cancel</Button>} />
                <Button variant="primary" onClick={submit} loading={status === "creating"}>
                  Create project
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
