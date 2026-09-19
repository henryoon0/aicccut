"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { spring } from "#/lib/springs.ts";
import { Button } from "#/components/ui/button.tsx";
import { InputField, InputGroup } from "#/components/ui/input-group.tsx";
import { Tabs, TabItem, TabsList } from "#/components/ui/tabs.tsx";
import { Kbd } from "#/components/ui/kbd.tsx";
import { PROJECTS } from "#/prototypes/mock";
import {
  ASPECTS,
  AspectFrame,
  CreatedNotice,
  DEFAULT_DRAFT,
  FPS_OPTIONS,
  HomeHeader,
  ProjectTile,
  RESOLUTIONS,
  isFps,
  isResolution,
  summaryLine,
  useCreateFlow,
  type Draft,
} from "./shared";

const layoutSpring = { ...spring.slow, duration: 0.28 };
const fadeIn = { duration: 0.15, delay: 0.1 };

/**
 * Inline — no modal. The "New project" tile in the grid grows in place into
 * a compact form; the other tiles slide aside. Escape puts it back.
 */
export function Inline() {
  const [expanded, setExpanded] = useState(true);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [touched, setTouched] = useState(false);
  const { status, create, reset } = useCreateFlow();
  const rootRef = useRef<HTMLDivElement>(null);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const nameError = touched && draft.name.trim() === "" ? "Name is required." : undefined;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expanded) {
        e.stopPropagation();
        setExpanded(false);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [expanded]);

  const submit = () => {
    setTouched(true);
    if (draft.name.trim() === "") return;
    create();
  };
  const collapse = () => {
    setExpanded(false);
    reset();
    setTouched(false);
  };
  const startOver = () => {
    reset();
    setDraft(DEFAULT_DRAFT);
    setTouched(false);
  };

  return (
    <div ref={rootRef} className="h-full w-full overflow-y-auto bg-surface-1">
      <HomeHeader onNew={() => setExpanded((v) => !v)} newActive={expanded} />
      <LayoutGroup>
        <div className="grid grid-cols-2 gap-4 px-8 pb-8 md:grid-cols-3 xl:grid-cols-4">
          <motion.div
            layout
            transition={layoutSpring}
            className={cn(
              "relative overflow-hidden rounded-lg",
              expanded ? "col-span-2 row-span-2 bg-surface-3 shadow-surface-3" : "bg-surface-2 shadow-surface-2"
            )}
            style={{ borderRadius: 8 }}
          >
            {expanded ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={fadeIn}
                className="flex h-full flex-col p-4"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && status === "idle" && !(e.target instanceof HTMLButtonElement)) {
                    e.preventDefault();
                    submit();
                  }
                }}
              >
                {status === "created" ? (
                  <CreatedNotice draft={draft} onReset={startOver} className="m-auto py-6" />
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="text-[14px] font-semibold text-foreground">New project</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          Press <Kbd>Esc</Kbd> to put this back.
                        </p>
                      </div>
                      <Button variant="ghost" size="icon-compact" className="ml-auto -mr-1 -mt-1" onClick={collapse} aria-label="Collapse">
                        <X size={14} />
                      </Button>
                    </div>

                    <div className="mt-3 grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4">
                      {/* live preview of the frame */}
                      <div className="grid place-items-center rounded-md bg-surface-1 p-4">
                        <div className="flex flex-col items-center gap-2">
                          <AspectFrame
                            aspect={draft.aspect}
                            size={180}
                            className="bg-foreground/[0.06] text-foreground/70 transition-[width,height] duration-200 ease-out motion-reduce:transition-none"
                          />
                          <span className="text-[11px] tabular-nums text-muted-foreground">{summaryLine(draft)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <InputGroup size="compact">
                          <InputField
                            label="Name"
                            index={0}
                            placeholder="Project name"
                            value={draft.name}
                            onChange={(v) => patch({ name: v })}
                            onBlur={() => setTouched(true)}
                            error={nameError}
                            autoFocus
                          />
                        </InputGroup>

                        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[12px]">
                          <span className="text-muted-foreground">Aspect</span>
                          <div role="radiogroup" className="flex flex-wrap gap-1.5">
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
                                    "flex h-7 items-center gap-1.5 rounded-md px-2 tabular-nums outline-none transition-colors duration-100",
                                    "focus-visible:ring-2 focus-visible:ring-ring",
                                    selected ? "bg-selected text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground"
                                  )}
                                >
                                  <AspectFrame aspect={a.id} size={12} />
                                  {a.label}
                                </button>
                              );
                            })}
                          </div>

                          <span className="text-muted-foreground">Frame rate</span>
                          <Tabs
                            size="compact"
                            value={String(draft.fps)}
                            onValueChange={(v) => {
                              const n = Number(v);
                              if (isFps(n)) patch({ fps: n });
                            }}
                          >
                            <TabsList className="w-fit">
                              {FPS_OPTIONS.map((o) => (
                                <TabItem key={o.value} value={String(o.value)} label={String(o.value)} />
                              ))}
                            </TabsList>
                          </Tabs>

                          <span className="text-muted-foreground">Resolution</span>
                          <Tabs
                            size="compact"
                            value={draft.resolution}
                            onValueChange={(v) => {
                              if (isResolution(v)) patch({ resolution: v });
                            }}
                          >
                            <TabsList className="w-fit">
                              {RESOLUTIONS.map((o) => (
                                <TabItem key={o.value} value={o.value} label={o.label} />
                              ))}
                            </TabsList>
                          </Tabs>
                        </div>

                        {draft.resolution === "custom" && (
                          <InputGroup size="compact" className="max-w-[260px]">
                            <InputField
                              label="W"
                              index={0}
                              inputMode="numeric"
                              value={String(draft.customWidth)}
                              onChange={(v) => patch({ customWidth: Math.max(16, Number(v.replace(/\D/g, "")) || 0) })}
                            />
                            <InputField
                              label="H"
                              index={1}
                              inputMode="numeric"
                              value={String(draft.customHeight)}
                              onChange={(v) => patch({ customHeight: Math.max(16, Number(v.replace(/\D/g, "")) || 0) })}
                            />
                          </InputGroup>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto flex items-center gap-3 pt-4">
                      <span className="text-[12px] text-muted-foreground">Opens in the editor right away.</span>
                      <Button variant="primary" size="compact" className="ml-auto" onClick={submit} loading={status === "creating"}>
                        Create
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.button
                key="tile"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={fadeIn}
                onClick={() => setExpanded(true)}
                className={cn(
                  "group flex h-full w-full flex-col gap-2 rounded-lg p-2 text-left outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <span className="grid aspect-video w-full place-items-center rounded-md border border-dashed border-border text-muted-foreground transition-colors duration-100 group-hover:bg-hover group-hover:text-foreground">
                  <span className="grid size-9 place-items-center rounded-full bg-surface-4 transition-transform duration-150 ease-out group-hover:scale-105">
                    <Plus size={16} />
                  </span>
                </span>
                <span className="px-1 pb-1">
                  <span className="block text-[13px] font-medium text-foreground">New project</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">Name, ratio, fps, resolution</span>
                </span>
              </motion.button>
            )}
          </motion.div>

          {PROJECTS.map((p) => (
            <motion.div key={p.id} layout transition={layoutSpring}>
              <ProjectTile project={p} className={cn("transition-opacity duration-200", expanded && "opacity-70")} />
            </motion.div>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
