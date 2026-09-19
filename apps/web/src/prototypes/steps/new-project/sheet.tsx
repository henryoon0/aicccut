"use client";

import { useState } from "react";
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
  ASPECTS,
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
  type Draft,
} from "./shared";

/**
 * Sheet — one dialog, every field visible at once. The reference form:
 * nothing hidden, nothing sequenced, one summary line telling you what you'll
 * get before you press Create.
 */
export function Sheet() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [touched, setTouched] = useState(false);
  const { status, create, reset } = useCreateFlow();

  const nameError = touched && draft.name.trim() === "" ? "Give the project a name." : undefined;
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const submit = () => {
    setTouched(true);
    if (draft.name.trim() === "") return;
    create();
  };

  const startOver = () => {
    reset();
    setDraft(DEFAULT_DRAFT);
    setTouched(false);
  };

  return (
    <div ref={setContainer} className="relative h-full w-full overflow-hidden">
      <HomeBackdrop dim={open} onNew={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogContent
          container={container}
          size="lg"
          onInteractOutside={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && status === "idle" && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              submit();
            }
          }}
        >
          {status === "created" ? (
            <CreatedNotice draft={draft} onReset={startOver} className="py-6" />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
                <DialogDescription>Name it and pick a format. You can change any of this later.</DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-5">
                <InputGroup>
                  <InputField
                    label="Name"
                    index={0}
                    placeholder="e.g. Claude Code 강의 7화"
                    value={draft.name}
                    onChange={(v) => patch({ name: v })}
                    onBlur={() => setTouched(true)}
                    error={nameError}
                    autoFocus
                  />
                </InputGroup>

                <fieldset className="flex flex-col gap-2">
                  <legend className="text-[12px] font-medium text-muted-foreground">Aspect ratio</legend>
                  <div role="radiogroup" className="grid grid-cols-4 gap-2">
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
                            "group flex flex-col items-center gap-2 rounded-lg border px-2 pt-3 pb-2 text-center transition-colors duration-100 outline-none",
                            "focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-foreground/60 bg-selected/40"
                              : "border-border hover:bg-hover active:bg-active"
                          )}
                        >
                          <div className="grid h-10 place-items-center">
                            <AspectFrame
                              aspect={a.id}
                              size={36}
                              className={cn(
                                "transition-colors duration-100",
                                selected ? "bg-foreground/10 text-foreground" : "text-muted-foreground group-hover:text-foreground"
                              )}
                            />
                          </div>
                          <span className={cn("text-[12px] tabular-nums", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>
                            {a.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-muted-foreground">Frame rate</span>
                    <Select
                      value={String(draft.fps)}
                      onValueChange={(v) => {
                        const n = Number(v);
                        if (isFps(n)) patch({ fps: n });
                      }}
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
                  <InputGroup size="compact">
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

                <div className="flex items-center gap-2 rounded-md bg-surface-3 px-3 py-2 text-[12px] tabular-nums text-muted-foreground">
                  <AspectFrame aspect={draft.aspect} size={14} className="shrink-0 text-muted-foreground" />
                  <span className="text-foreground">{summaryLine(draft)}</span>
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
