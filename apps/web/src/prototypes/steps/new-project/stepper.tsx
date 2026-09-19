"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { spring } from "#/lib/springs.ts";
import { Elevated } from "#/lib/elevated.tsx";
import { Button } from "#/components/ui/button.tsx";
import { InputField, InputGroup } from "#/components/ui/input-group.tsx";
import { RadioGroup, RadioItem } from "#/components/ui/radio-group.tsx";
import {
  ASPECTS,
  AspectFrame,
  CreatedNotice,
  DEFAULT_DRAFT,
  FPS_OPTIONS,
  HomeBackdrop,
  RESOLUTIONS,
  dimensionsFor,
  isFps,
  isResolution,
  summaryLine,
  useCreateFlow,
  type Draft,
} from "./shared";

const STEPS = ["Name", "Format", "Confirm"] as const;

/**
 * Stepper — three small questions instead of one big form. Each screen has
 * one job; the progress rail tells you how much is left.
 */
export function Stepper() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [touched, setTouched] = useState(false);
  const { status, create, reset } = useCreateFlow();

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const nameValid = draft.name.trim() !== "";
  const nameError = touched && !nameValid ? "Give the project a name." : undefined;

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };
  const next = () => {
    if (step === 0) {
      setTouched(true);
      if (!nameValid) return;
    }
    if (step < 2) go(step + 1);
    else create();
  };
  const back = () => step > 0 && go(step - 1);
  const startOver = () => {
    reset();
    setDraft(DEFAULT_DRAFT);
    setTouched(false);
    setDir(-1);
    setStep(0);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <HomeBackdrop dim />
      <div className="absolute inset-0 z-10 grid place-items-center bg-black/40 p-6 dark:bg-black/70">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={spring.slow}
          className="w-full max-w-[460px]"
        >
          <Elevated offset={4} className="overflow-hidden rounded-xl">
            {status === "created" ? (
              <CreatedNotice draft={draft} onReset={startOver} className="px-6 py-10" />
            ) : (
              <>
                {/* Progress rail */}
                <ol className="flex items-center gap-2 px-6 pt-5" aria-label="Progress">
                  {STEPS.map((label, i) => {
                    const state = i < step ? "done" : i === step ? "current" : "todo";
                    return (
                      <li key={label} className="flex flex-1 flex-col gap-2">
                        <div className="h-[3px] overflow-hidden rounded-full bg-surface-2">
                          <motion.div
                            className="h-full rounded-full bg-foreground"
                            initial={false}
                            animate={{ scaleX: state === "todo" ? 0 : 1 }}
                            style={{ originX: 0 }}
                            transition={spring.moderate}
                          />
                        </div>
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            state === "current" ? "text-foreground" : "text-muted-foreground"
                          )}
                          aria-current={state === "current" ? "step" : undefined}
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                {/* Slide stage */}
                <div className="relative min-h-[260px] px-6 pt-6">
                  <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                    <motion.div
                      key={step}
                      custom={dir}
                      variants={{
                        enter: (d: number) => ({ x: d * 32, opacity: 0 }),
                        center: { x: 0, opacity: 1 },
                        exit: (d: number) => ({ x: d * -32, opacity: 0 }),
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ ...spring.moderate, duration: 0.2 }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
                          e.preventDefault();
                          next();
                        }
                      }}
                    >
                      {step === 0 && (
                        <StepName draft={draft} onChange={patch} error={nameError} onBlur={() => setTouched(true)} />
                      )}
                      {step === 1 && <StepFormat draft={draft} onChange={patch} />}
                      {step === 2 && <StepConfirm draft={draft} />}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-2 px-6 pb-6 pt-4">
                  <Button variant="ghost" leadingIcon={ChevronLeft} onClick={back} disabled={step === 0}>
                    Back
                  </Button>
                  <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
                    {step + 1} / {STEPS.length}
                  </span>
                  {step < 2 ? (
                    <Button variant="primary" trailingIcon={ChevronRight} onClick={next}>
                      Next
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={next} loading={status === "creating"}>
                      Create project
                    </Button>
                  )}
                </div>
              </>
            )}
          </Elevated>
        </motion.div>
      </div>
    </div>
  );
}

function StepName({
  draft,
  onChange,
  error,
  onBlur,
}: {
  draft: Draft;
  onChange: (p: Partial<Draft>) => void;
  error?: string;
  onBlur: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight text-foreground">What are you making?</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">A name you'll recognise in the projects list.</p>
      </div>
      <InputGroup>
        <InputField
          label="Project name"
          index={0}
          placeholder="e.g. Threads 릴스 · 프롬프트 3줄 요약"
          value={draft.name}
          onChange={(v) => onChange({ name: v })}
          onBlur={onBlur}
          error={error}
          autoFocus
        />
      </InputGroup>
    </div>
  );
}

function StepFormat({ draft, onChange }: { draft: Draft; onChange: (p: Partial<Draft>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Where will it play?</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Pick the frame, then the timing and detail.</p>
      </div>

      <div role="radiogroup" aria-label="Aspect ratio" className="grid grid-cols-4 gap-2">
        {ASPECTS.map((a) => {
          const selected = draft.aspect === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ aspect: a.id })}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-2 pt-3 outline-none transition-colors duration-100",
                "focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-foreground/60 bg-selected/40" : "border-border hover:bg-hover active:bg-active"
              )}
            >
              <div className="grid h-9 place-items-center">
                <AspectFrame aspect={a.id} size={32} className={selected ? "text-foreground" : "text-muted-foreground"} />
              </div>
              <span className={cn("text-[12px] tabular-nums", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {a.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">Frame rate</span>
          <RadioGroup
            size="compact"
            value={String(draft.fps)}
            onValueChange={(v) => {
              const n = Number(v);
              if (isFps(n)) onChange({ fps: n });
            }}
          >
            {FPS_OPTIONS.map((o, i) => (
              <RadioItem key={o.value} index={i} value={String(o.value)} label={o.label} />
            ))}
          </RadioGroup>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">Resolution</span>
          <RadioGroup
            size="compact"
            value={draft.resolution}
            onValueChange={(v) => {
              if (isResolution(v)) onChange({ resolution: v });
            }}
          >
            {RESOLUTIONS.map((o, i) => (
              <RadioItem key={o.value} index={i} value={o.value} label={o.label} />
            ))}
          </RadioGroup>
          {draft.resolution === "custom" && (
            <InputGroup size="compact" className="mt-1">
              <InputField
                label="W"
                index={0}
                inputMode="numeric"
                value={String(draft.customWidth)}
                onChange={(v) => onChange({ customWidth: Math.max(16, Number(v.replace(/\D/g, "")) || 0) })}
              />
              <InputField
                label="H"
                index={1}
                inputMode="numeric"
                value={String(draft.customHeight)}
                onChange={(v) => onChange({ customHeight: Math.max(16, Number(v.replace(/\D/g, "")) || 0) })}
              />
            </InputGroup>
          )}
        </div>
      </div>
    </div>
  );
}

function StepConfirm({ draft }: { draft: Draft }) {
  const { width, height } = dimensionsFor(draft);
  const rows: [string, string][] = [
    ["Name", draft.name.trim()],
    ["Aspect ratio", draft.aspect],
    ["Frame rate", `${draft.fps} fps`],
    ["Resolution", `${width} × ${height}`],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Ready to create</h2>
        <p className="mt-1 text-[13px] tabular-nums text-muted-foreground">{summaryLine(draft)}</p>
      </div>
      <div className="flex items-start gap-5 rounded-lg bg-surface-2 p-4">
        <div className="grid size-20 shrink-0 place-items-center rounded-md bg-surface-1">
          <AspectFrame aspect={draft.aspect} size={56} className="bg-foreground/10 text-foreground" />
        </div>
        <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate tabular-nums text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
