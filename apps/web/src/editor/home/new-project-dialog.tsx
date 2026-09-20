import { useEffect, useState, type ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select";
import type { Aspect, CreateProjectInput, Fps } from "#/editor/core";
import { cn } from "#/lib/utils";

// ── Domain ───────────────────────────────────────────────

type Resolution = "1080p" | "4k" | "custom";

interface AspectDef { id: Aspect; label: string; w: number; h: number }

const ASPECTS: readonly AspectDef[] = [
  { id: "16:9", label: "16:9", w: 16, h: 9 },
  { id: "9:16", label: "9:16", w: 9, h: 16 },
  { id: "1:1", label: "1:1", w: 1, h: 1 },
  { id: "4:5", label: "4:5", w: 4, h: 5 },
];

const FPS_OPTIONS: readonly { value: Fps; label: string }[] = [
  { value: 24, label: "24 fps" },
  { value: 25, label: "25 fps" },
  { value: 30, label: "30 fps" },
  { value: 60, label: "60 fps" },
];

const RESOLUTIONS: readonly { value: Resolution; label: string }[] = [
  { value: "1080p", label: "1080p" },
  { value: "4k", label: "4K" },
  { value: "custom", label: "직접 입력" },
];

/** Custom width/height stay as typed (strings) so "720" is not clamped to "16…" mid-keystroke; they are parsed by `customSize`. */
interface Draft { name: string; aspect: Aspect; fps: Fps; resolution: Resolution; customWidth: string; customHeight: string }

const DEFAULT_DRAFT: Draft = { name: "", aspect: "16:9", fps: 30, resolution: "1080p", customWidth: "1920", customHeight: "1080" };

const MIN_SIDE = 16;
const MAX_SIDE = 8192;
const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 5);
/** Parse a typed side length; blank or out-of-range falls back to the bound. */
const customSide = (v: string) => Math.min(MAX_SIDE, Math.max(MIN_SIDE, Number(v) || MIN_SIDE));

const aspectDef = (id: Aspect) => ASPECTS.find((a) => a.id === id) ?? ASPECTS[0];
const isFps = (n: number): n is Fps => n === 24 || n === 25 || n === 30 || n === 60;
const isResolution = (s: string): s is Resolution => s === "1080p" || s === "4k" || s === "custom";

/** Pixel dimensions implied by a draft: short side 1080 (1080p) or 2160 (4K), long side follows the ratio. */
function dimensionsFor(draft: Draft): { width: number; height: number } {
  if (draft.resolution === "custom") return { width: customSide(draft.customWidth), height: customSide(draft.customHeight) };
  const short = draft.resolution === "4k" ? 2160 : 1080;
  const a = aspectDef(draft.aspect);
  return a.w >= a.h ? { width: Math.round((short * a.w) / a.h), height: short } : { width: short, height: Math.round((short * a.h) / a.w) };
}

function summaryLine(draft: Draft): string {
  const { width, height } = dimensionsFor(draft);
  return `${width}×${height} · ${draft.fps} fps · ${draft.aspect}`;
}

/** A proportional rectangle for an aspect ratio, fitted inside a square box. */
export function AspectFrame({ aspect, size = 40, className, children }: { aspect: Aspect; size?: number; className?: string; children?: ReactNode }) {
  const a = aspectDef(aspect);
  const scale = size / Math.max(a.w, a.h);
  return (
    <div className={cn("relative rounded-[3px] border border-current", className)} style={{ width: a.w * scale, height: a.h * scale }}>
      {children}
    </div>
  );
}

// ── Dialog ───────────────────────────────────────────────

export function NewProjectDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (input: Required<Pick<CreateProjectInput, "name" | "aspect" | "fps" | "width" | "height">>) => Promise<void> | void }) {
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [touched, setTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  // A fresh form every time the dialog opens.
  useEffect(() => {
    if (open) {
      setDraft(DEFAULT_DRAFT);
      setTouched(false);
      setCreating(false);
    }
  }, [open]);

  const nameError = touched && draft.name.trim() === "" ? "프로젝트 이름을 입력하세요." : undefined;
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const submit = async () => {
    setTouched(true);
    if (draft.name.trim() === "" || creating) return;
    setCreating(true);
    try {
      await onCreate({ name: draft.name.trim(), aspect: draft.aspect, fps: draft.fps, ...dimensionsFor(draft) });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !creating && onOpenChange(o)}>
      <DialogContent
        size="lg"
        onKeyDown={(e) => {
          // Enter submits only from a text field. Buttons/radios/select options
          // (whose keydown bubbles up through the portal) keep their own Enter.
          if (e.key === "Enter" && !creating && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>새 프로젝트</DialogTitle>
          <DialogDescription>이름을 정하고 형식을 고르세요. 나중에 언제든 바꿀 수 있습니다.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <InputGroup>
            <InputField label="이름" index={0} placeholder="예: Claude Code 강의 7화" value={draft.name} onChange={(v) => patch({ name: v })} onBlur={() => setTouched(true)} error={nameError} autoFocus />
          </InputGroup>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[12px] font-medium text-muted-foreground">화면 비율</legend>
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
                      "group flex flex-col items-center gap-2 rounded-lg border px-2 pb-2 pt-3 text-center outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "border-foreground/60 bg-selected/40" : "border-border hover:bg-hover active:bg-active"
                    )}
                  >
                    <div className="grid h-10 place-items-center">
                      <AspectFrame aspect={a.id} size={36} className={cn("transition-colors duration-100", selected ? "bg-foreground/10 text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    </div>
                    <span className={cn("text-[12px] tabular-nums", selected ? "font-semibold text-foreground" : "text-muted-foreground")}>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">프레임 레이트</span>
              <Select value={String(draft.fps)} onValueChange={(v) => { const n = Number(v); if (isFps(n)) patch({ fps: n }); }}>
                <SelectTrigger />
                <SelectContent>
                  {FPS_OPTIONS.map((o, i) => (
                    <SelectItem key={o.value} value={String(o.value)} index={i}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">해상도</span>
              <Select value={draft.resolution} onValueChange={(v) => { if (isResolution(v)) patch({ resolution: v }); }}>
                <SelectTrigger />
                <SelectContent>
                  {RESOLUTIONS.map((o, i) => (
                    <SelectItem key={o.value} value={o.value} index={i}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {draft.resolution === "custom" && (
            <InputGroup size="compact" className="w-full flex-row">
              <InputField label="가로" index={0} className="flex-1" inputMode="numeric" value={draft.customWidth} onChange={(v) => patch({ customWidth: digitsOnly(v) })} onBlur={() => patch({ customWidth: String(customSide(draft.customWidth)) })} />
              <InputField label="세로" index={1} className="flex-1" inputMode="numeric" value={draft.customHeight} onChange={(v) => patch({ customHeight: digitsOnly(v) })} onBlur={() => patch({ customHeight: String(customSide(draft.customHeight)) })} />
            </InputGroup>
          )}

          <div className="flex items-center gap-2 rounded-md bg-surface-3 px-3 py-2 text-[12px] tabular-nums text-muted-foreground">
            <AspectFrame aspect={draft.aspect} size={14} className="shrink-0 text-muted-foreground" />
            <span className="text-foreground">{summaryLine(draft)}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <DialogClose render={<Button variant="secondary" disabled={creating}>취소</Button>} />
          <Button variant="primary" onClick={() => void submit()} loading={creating}>
            프로젝트 만들기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
