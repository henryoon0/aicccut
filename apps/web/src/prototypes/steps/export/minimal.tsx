"use client";

/**
 * Minimal — one Export button in the top bar opens a tiny popover: a
 * resolution Select, a Small / Balanced / Best segmented control, Export.
 * Progress lives in the top bar as a slim strip under the button; the done
 * state is a toast at the bottom with Save.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, Upload, X } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select.tsx";
import { Tabs, TabItem, TabsList } from "#/components/ui/tabs.tsx";
import { Elevated } from "#/lib/elevated.tsx";
import { spring } from "#/lib/springs.ts";
import { fileSize } from "#/prototypes/mock";
import {
  DEFAULT_SETTINGS, EditorFrame, RESOLUTIONS, estimateBytes, etaLabel, fileName, specLine, useRender,
  type ExportSettings, type Resolution,
} from "./shared";

type Tier = "small" | "balanced" | "best";
const TIERS: Record<Tier, { label: string; quality: number; hint: string }> = {
  small: { label: "Small", quality: 30, hint: "Quick to send" },
  balanced: { label: "Balanced", quality: 60, hint: "Good for most uploads" },
  best: { label: "Best", quality: 95, hint: "Archive quality" },
};

export function MinimalVariant() {
  const [open, setOpen] = useState(true);
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [tier, setTier] = useState<Tier>("balanced");
  const [toast, setToast] = useState(false);
  const { state, start, cancel, reset } = useRender();
  const popRef = useRef<HTMLDivElement>(null);
  const settings: ExportSettings = { ...DEFAULT_SETTINGS, resolution, quality: TIERS[tier].quality };
  const busy = state.status === "rendering";

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => {
    if (state.status === "done") setToast(true);
  }, [state.status]);

  const exportNow = () => { setOpen(false); setToast(false); start(settings); };
  const dismissToast = () => { setToast(false); reset(); };

  return (
    <EditorFrame
      topRight={
        <div ref={popRef} className="relative">
          {busy ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] tabular-nums text-muted-foreground">{Math.round(state.progress * 100)}% · {etaLabel(state.eta)}</span>
              <Button variant="ghost" size="compact" leadingIcon={X} onClick={cancel}>Cancel</Button>
            </div>
          ) : (
            <Button size="compact" leadingIcon={Upload} active={open} onClick={() => setOpen((o) => !o)}>Export</Button>
          )}
          <AnimatePresence>
            {open && !busy && (
              <motion.div
                key="pop"
                role="dialog"
                aria-label="Export"
                className="absolute right-0 top-full z-30 mt-2 w-[280px] origin-top-right"
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={spring.moderate}
              >
                <Elevated offset={2} className="rounded-lg p-3">
                  <div className="grid gap-3">
                    <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)} size="compact">
                      <SelectTrigger className="w-full" />
                      <SelectContent>{RESOLUTIONS.map((r, i) => <SelectItem key={r.id} index={i} value={r.id}>{r.label} · {r.hint}</SelectItem>)}</SelectContent>
                    </Select>
                    <Tabs value={tier} onValueChange={(v) => setTier(v as Tier)} size="compact">
                      <TabsList className="w-full">
                        {(Object.keys(TIERS) as Tier[]).map((t) => <TabItem key={t} value={t} label={TIERS[t].label} />)}
                      </TabsList>
                    </Tabs>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{TIERS[tier].hint}</span>
                      <motion.span key={resolution + tier} className="tabular-nums text-foreground" initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={spring.fast}>
                        ~{fileSize(estimateBytes(settings))}
                      </motion.span>
                    </div>
                    <Button size="compact" leadingIcon={Upload} onClick={exportNow}>Export MP4</Button>
                    {state.status === "cancelled" && <span className="text-center text-[11px] text-muted-foreground">Last export was cancelled.</span>}
                  </div>
                </Elevated>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      belowTopBar={
        <div className="relative h-0">
          <AnimatePresence>
            {busy && (
              <motion.div
                key="bar"
                className="absolute inset-x-0 top-0 h-[3px] bg-surface-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={spring.fast}
                role="progressbar"
                aria-valuenow={Math.round(state.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full" style={{ width: `${state.progress * 100}%`, background: state.tint }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            role="status"
            className="absolute bottom-5 left-1/2 z-30 flex w-[min(92%,440px)] items-center gap-3 rounded-lg bg-surface-6 p-3 pl-4 shadow-surface-6"
            initial={{ opacity: 0, y: 16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 8, x: "-50%" }}
            transition={spring.slow}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Check size={13} strokeWidth={2.5} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{fileName(settings)} is ready</div>
              <div className="truncate text-[11px] text-muted-foreground">{specLine(settings)} · {fileSize(estimateBytes(settings))}</div>
            </div>
            <Button size="compact" leadingIcon={Download} onClick={dismissToast}>Save</Button>
            <Button variant="ghost" size="icon-compact" aria-label="Dismiss" onClick={dismissToast}><X /></Button>
          </motion.div>
        )}
      </AnimatePresence>
    </EditorFrame>
  );
}
