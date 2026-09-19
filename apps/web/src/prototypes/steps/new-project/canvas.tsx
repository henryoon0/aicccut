"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { Button } from "#/components/ui/button.tsx";
import { Tabs, TabItem, TabsList } from "#/components/ui/tabs.tsx";
import {
  ASPECTS,
  CreatedNotice,
  DEFAULT_DRAFT,
  FPS_OPTIONS,
  HomeBackdrop,
  RESOLUTIONS,
  aspectDef,
  dimensionsFor,
  isFps,
  isResolution,
  useCreateFlow,
  type Draft,
} from "./shared";

const BOX_W = 520;
const BOX_H = 300;

function frameSize(draft: Draft) {
  const a = aspectDef(draft.aspect);
  const ratio = a.w / a.h;
  let w = BOX_W;
  let h = w / ratio;
  if (h > BOX_H) {
    h = BOX_H;
    w = h * ratio;
  }
  return { w: Math.round(w), h: Math.round(h) };
}

const morph = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.9 };

/**
 * Canvas — the format is chosen by looking at it. One big frame morphs
 * between ratios; everything else is a quiet pill under it.
 */
export function Canvas() {
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [touched, setTouched] = useState(false);
  const { status, create, reset } = useCreateFlow();
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const invalid = draft.name.trim() === "";
  const { w, h } = frameSize(draft);
  const dims = dimensionsFor(draft);

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    create();
  };
  const startOver = () => {
    reset();
    setDraft(DEFAULT_DRAFT);
    setTouched(false);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-1">
      <div className="absolute inset-0 scale-[1.03] blur-[2px]">
        <HomeBackdrop dim />
      </div>
      <div className="absolute inset-0 bg-black/70 dark:bg-black/85" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex h-full flex-col text-foreground"
        onKeyDown={(e) => {
          if (e.key === "Enter" && status === "idle" && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <div className="flex items-center px-6 pt-5">
          <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">New project</span>
          <Button variant="ghost" size="icon" className="ml-auto" aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {status === "created" ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="grid flex-1 place-items-center"
            >
              <CreatedNotice draft={draft} onReset={startOver} />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 flex-col items-center justify-center gap-7 px-6 pb-10"
            >
              {/* Name: big, borderless */}
              <div className="flex w-full max-w-[640px] flex-col items-center">
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) => {
                    patch({ name: e.target.value });
                    if (e.target.value.trim() !== "") setTouched(false);
                  }}
                  placeholder="Untitled project"
                  aria-label="Project name"
                  aria-invalid={touched && invalid}
                  className={cn(
                    "w-full bg-transparent text-center text-[30px] font-semibold tracking-tight outline-none",
                    "placeholder:text-muted-foreground/50 caret-foreground",
                    touched && invalid && "placeholder:text-destructive/70"
                  )}
                />
                <div className="mt-2 h-4 text-[12px]">
                  <AnimatePresence>
                    {touched && invalid && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-destructive"
                      >
                        Type a name to continue.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* The live frame */}
              <div className="grid place-items-center" style={{ width: BOX_W, height: BOX_H }}>
                <motion.div
                  className="relative overflow-hidden rounded-[6px] bg-surface-3 shadow-surface-4 ring-1 ring-foreground/15"
                  animate={{ width: w, height: h }}
                  transition={morph}
                  initial={false}
                >
                  {/* safe area guides */}
                  <div className="pointer-events-none absolute inset-[8%] rounded-[3px] border border-dashed border-foreground/15" />
                  <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-foreground/[0.06]" />
                  <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-foreground/[0.06]" />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: "radial-gradient(120% 80% at 50% 0%, rgb(255 255 255 / 0.06), transparent 60%)" }}
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-2.5 text-[11px] tabular-nums text-muted-foreground">
                    <span>{draft.aspect}</span>
                    <motion.span key={`${dims.width}x${dims.height}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                      {dims.width} × {dims.height}
                    </motion.span>
                  </div>
                </motion.div>
              </div>

              {/* Ratio pills */}
              <div role="radiogroup" aria-label="Aspect ratio" className="flex items-center gap-1 rounded-full bg-surface-2 p-1 shadow-surface-2">
                {ASPECTS.map((a) => {
                  const selected = a.id === draft.aspect;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => patch({ aspect: a.id })}
                      className={cn(
                        "relative h-8 rounded-full px-3.5 text-[13px] tabular-nums outline-none transition-colors duration-100",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "text-background" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {selected && (
                        <motion.span
                          layoutId="canvas-aspect-pill"
                          className="absolute inset-0 rounded-full bg-foreground"
                          transition={morph}
                        />
                      )}
                      <span className="relative">{a.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* fps · resolution */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Tabs
                  size="compact"
                  value={String(draft.fps)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    if (isFps(n)) patch({ fps: n });
                  }}
                >
                  <TabsList aria-label="Frame rate">
                    {FPS_OPTIONS.map((o) => (
                      <TabItem key={o.value} value={String(o.value)} label={`${o.value} fps`} />
                    ))}
                  </TabsList>
                </Tabs>
                <Tabs
                  size="compact"
                  value={draft.resolution}
                  onValueChange={(v) => {
                    if (isResolution(v)) patch({ resolution: v });
                  }}
                >
                  <TabsList aria-label="Resolution">
                    {RESOLUTIONS.map((o) => (
                      <TabItem key={o.value} value={o.value} label={o.label} />
                    ))}
                  </TabsList>
                </Tabs>
                {draft.resolution === "custom" && (
                  <div className="flex items-center gap-1.5 text-[12px] tabular-nums text-muted-foreground">
                    <input
                      inputMode="numeric"
                      aria-label="Width"
                      value={draft.customWidth}
                      onChange={(e) => patch({ customWidth: Math.max(16, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                      className="h-7 w-16 rounded-md bg-surface-3 px-2 text-center text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    ×
                    <input
                      inputMode="numeric"
                      aria-label="Height"
                      value={draft.customHeight}
                      onChange={(e) => patch({ customHeight: Math.max(16, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                      className="h-7 w-16 rounded-md bg-surface-3 px-2 text-center text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                )}
              </div>

              <Button variant="primary" trailingIcon={ArrowRight} onClick={submit} loading={status === "creating"} className="mt-1 min-w-[160px]">
                Create
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
