import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { useActions, useEditor, useEditorStore, useTransportState, type Document } from "#/editor/core";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { useDocumentRender } from "./render";
import { RenderStep } from "./render-step";
import { WhatStep, WhereStep } from "./steps";
import {
  DEFAULT_SETTINGS, downloadProjectFile, exportContext, fpsValue, rangeSeconds, rangeStart, slugify,
  type Destination, type ExportSettings,
} from "./settings";

type Step = 0 | 1 | 2;
const STEPS = ["What", "Where", "Render"] as const;

/**
 * ExportWizard — three calm screens over the document: What (format and
 * quality), Where (destination and file name), Render (a big frame and one
 * slow bar). Open whenever `uiPanels.dialog` is "export"; every way out goes
 * through `actions.closeDialog()`.
 *
 * The document is snapshotted when the dialog opens. It is modal, so nothing
 * can edit the timeline underneath, and the snapshot keeps the wizard from
 * re-rendering on every timeline drag while it sits closed.
 */
export function ExportWizard() {
  const open = useEditor((s) => s.uiPanels.dialog === "export");
  const actions = useActions();
  const store = useEditorStore();
  const { inPoint, outPoint } = useTransportState();
  const reduce = useReducedMotion();

  const [doc, setDoc] = useState<Document | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState(1);
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const [destination, setDestination] = useState<Destination>("download");
  const [name, setName] = useState("");
  const { state, start, cancel, reset } = useDocumentRender();

  const busy = state.status === "rendering";

  // A fresh wizard every time it opens, seeded from the live document.
  useEffect(() => {
    if (!open) return;
    const current = store.getState().doc;
    setDoc(current);
    setName(slugify(current.project.name));
    setSettings(DEFAULT_SETTINGS);
    setDestination("download");
    setStep(0);
    setDir(1);
    reset();
  }, [open, store, reset]);

  const ctx = useMemo(
    () => exportContext(doc ?? store.getState().doc, inPoint, outPoint),
    [doc, store, inPoint, outPoint],
  );

  // A range that stops existing (points cleared) falls back to the whole document.
  useEffect(() => {
    if (settings.range === "inout" && !ctx.hasInOut) setSettings((p) => ({ ...p, range: "whole" }));
  }, [settings.range, ctx.hasInOut]);

  const go = useCallback((next: Step) => {
    setDir((prev) => (next === step ? prev : next > step ? 1 : -1));
    setStep(next);
  }, [step]);

  const dismiss = useCallback(() => {
    if (busy) return;
    actions.closeDialog();
  }, [busy, actions]);

  const beginRender = useCallback(() => {
    if (!doc) return;
    go(2);
    start(doc, { startTime: rangeStart(settings, ctx), seconds: rangeSeconds(settings, ctx), fps: fpsValue(settings, ctx) });
  }, [doc, go, start, settings, ctx]);

  const download = useCallback(() => {
    if (!doc) return;
    downloadProjectFile(doc, settings, ctx, name);
  }, [doc, settings, ctx, name]);

  const slide = {
    enter: (d: number) => ({ x: reduce ? 0 : d * 48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduce ? 0 : d * -48, opacity: 0 }),
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent
        size="xl"
        showCloseButton={false}
        className="flex h-[min(88dvh,540px)] max-w-[640px] flex-col overflow-hidden p-0"
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        onInteractOutside={(e) => { if (busy) e.preventDefault(); }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>Pick a format, choose where the file goes, then render.</DialogDescription>
        </DialogHeader>

        <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-4">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              disabled={busy || i > step}
              onClick={() => go(i as Step)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-[12px] outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring",
                i === step ? "text-foreground" : "text-muted-foreground",
                i < step && !busy && "hover:bg-hover",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[10px] font-medium tabular-nums",
                  i < step ? "bg-emerald-500 text-white" : i === step ? "bg-foreground text-background" : "bg-surface-7 text-muted-foreground",
                )}
              >
                {i < step ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              {label}
              {i < STEPS.length - 1 && <span className="ml-1 h-px w-6 bg-border" />}
            </button>
          ))}
          <Button variant="ghost" size="icon-compact" className="ml-auto" aria-label="Close" onClick={dismiss} disabled={busy}>
            <X />
          </Button>
        </header>

        <div className="relative min-h-0 flex-1">
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
            <motion.section
              key={step}
              custom={dir}
              className="absolute inset-0 flex flex-col"
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={spring.moderate}
            >
              {step === 0 && (
                <WhatStep
                  settings={settings}
                  ctx={ctx}
                  onPatch={(p) => setSettings((prev) => ({ ...prev, ...p }))}
                  onNext={() => go(1)}
                />
              )}
              {step === 1 && (
                <WhereStep
                  settings={settings}
                  ctx={ctx}
                  destination={destination}
                  onDestination={setDestination}
                  name={name}
                  onName={setName}
                  onBack={() => go(0)}
                  onRender={beginRender}
                />
              )}
              {step === 2 && (
                <RenderStep
                  settings={settings}
                  ctx={ctx}
                  destination={destination}
                  name={name}
                  state={state}
                  onCancel={cancel}
                  onRetry={beginRender}
                  onBack={() => { reset(); go(1); }}
                  onAgain={() => { reset(); go(0); }}
                  onDownload={download}
                />
              )}
            </motion.section>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
