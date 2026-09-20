import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Cloud, Download, Link2, Upload } from "lucide-react";
import { Button } from "#/components/ui/button";
import { RadioGroup, RadioItem } from "#/components/ui/radio-group";
import { Slider } from "#/components/ui/slider";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { Tooltip } from "#/components/ui/tooltip";
import { fileSize, shortDuration } from "#/editor/core";
import { cn } from "#/lib/utils";
import {
  FORMATS, FPS_CHOICES, PROJECT_FILE_EXT, RESOLUTIONS,
  estimateBytes, formatDef, qualityLabel, rangeSeconds, specLine,
  type Destination, type ExportContext, type ExportSettings, type Format, type FpsChoice, type Range, type Resolution,
} from "./settings";

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function Footer({ left, children }: { left?: ReactNode; children: ReactNode }) {
  return (
    <footer className="flex h-14 shrink-0 items-center gap-3 border-t border-border px-4 text-[12px] text-muted-foreground">
      {left}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </footer>
  );
}

// ── Step 1 · What ────────────────────────────────────────

export interface WhatStepProps {
  settings: ExportSettings;
  ctx: ExportContext;
  onPatch: (patch: Partial<ExportSettings>) => void;
  onNext: () => void;
}

/** Format, resolution, frame rate, quality and range, under a live size estimate. */
export function WhatStep({ settings: s, ctx, onPatch, onNext }: WhatStepProps) {
  const audioOnly = formatDef(s.format).audioOnly;
  return (
    <>
      <div className="grid flex-1 grid-cols-2 gap-5 overflow-y-auto p-6">
        <Field label="형식">
          <RadioGroup value={s.format} onValueChange={(v) => onPatch({ format: v as Format })} size="compact">
            {FORMATS.map((f, i) => (
              <RadioItem key={f.id} index={i} value={f.id} label={f.label} />
            ))}
          </RadioGroup>
          <p className="mt-1 text-[11px] text-muted-foreground">{formatDef(s.format).hint}</p>
        </Field>

        <div className="grid content-start gap-4">
          <Field label="해상도">
            <Tabs
              value={s.resolution}
              onValueChange={(v) => onPatch({ resolution: v as Resolution })}
              size="compact"
              className={cn(audioOnly && "pointer-events-none opacity-40")}
            >
              <TabsList className="w-full">
                {RESOLUTIONS.map((r) => (
                  <TabItem key={r.id} value={r.id} label={r.label} />
                ))}
              </TabsList>
            </Tabs>
          </Field>

          <Field label="프레임 레이트">
            <Tabs
              value={s.fps}
              onValueChange={(v) => onPatch({ fps: v as FpsChoice })}
              size="compact"
              className={cn(audioOnly && "pointer-events-none opacity-40")}
            >
              <TabsList className="w-full">
                {FPS_CHOICES.map((f) => (
                  <TabItem key={f} value={f} label={f === "source" ? "원본" : f} />
                ))}
              </TabsList>
            </Tabs>
          </Field>

          {/* The slider's own value display would repeat the heading, so the
              reading sits on the right of the heading row instead — where it
              cannot shove the track around as the words change width. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">품질</span>
              <span className="text-[12px] tabular-nums text-muted-foreground">{s.quality} · {qualityLabel(s.quality)}</span>
            </div>
            <Slider
              value={s.quality}
              onChange={(v) => onPatch({ quality: Array.isArray(v) ? v[0] : v })}
              min={10}
              max={100}
              step={5}
              size="compact"
              showValue={false}
              label="품질"
            />
          </div>

          <Field label="범위">
            <Tabs value={s.range} onValueChange={(v) => onPatch({ range: v as Range })} size="compact">
              <TabsList className="w-full">
                <TabItem value="whole" label="전체" />
                <TabItem value="inout" label="시작점 → 끝점" disabled={!ctx.hasInOut} />
              </TabsList>
            </Tabs>
            {!ctx.hasInOut && <p className="text-[11px] text-muted-foreground">타임라인에서 시작점과 끝점을 지정하면 범위를 내보낼 수 있습니다.</p>}
          </Field>
        </div>
      </div>

      <Footer left={<span className="truncate">{specLine(s, ctx)} · 약 {fileSize(estimateBytes(s, ctx))}</span>}>
        <Button trailingIcon={ArrowRight} onClick={onNext}>다음</Button>
      </Footer>
    </>
  );
}

// ── Step 2 · Where ───────────────────────────────────────

const DESTINATIONS: readonly { id: Destination; label: string; hint: string; icon: typeof Download; disabled?: boolean }[] = [
  { id: "download", label: "다운로드", hint: "이 컴퓨터에 저장합니다", icon: Download },
  { id: "drive", label: "드라이브에 저장", hint: "아직 준비 중", icon: Cloud, disabled: true },
  { id: "link", label: "링크 복사", hint: "이 편집 화면의 주소를 복사합니다", icon: Link2 },
];

export interface WhereStepProps {
  settings: ExportSettings;
  ctx: ExportContext;
  destination: Destination;
  onDestination: (d: Destination) => void;
  name: string;
  onName: (name: string) => void;
  onBack: () => void;
  onRender: () => void;
}

/** Destination and file name, over a summary of what step one decided. */
export function WhereStep({ settings: s, ctx, destination, onDestination, name, onName, onBack, onRender }: WhereStepProps) {
  return (
    <>
      <div className="grid flex-1 content-start gap-5 overflow-y-auto p-6">
        <Field label="저장 위치">
          <div className="grid grid-cols-3 gap-2">
            {DESTINATIONS.map((d) => {
              const selected = destination === d.id;
              const card = (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={d.disabled || undefined}
                  onClick={() => !d.disabled && onDestination(d.id)}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3 text-left outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-ring",
                    d.disabled
                      ? "cursor-not-allowed border-border bg-surface-4 opacity-50"
                      : selected
                        ? "border-foreground/60 bg-selected/40"
                        : "border-border bg-surface-4 hover:bg-hover active:bg-active",
                  )}
                >
                  <d.icon size={18} strokeWidth={1.5} className={selected ? "text-foreground" : "text-muted-foreground"} />
                  <div>
                    <div className="text-[13px] font-medium">{d.label}</div>
                    <div className="text-[11px] text-muted-foreground">{d.hint}</div>
                  </div>
                </button>
              );
              return d.disabled ? (
                <Tooltip key={d.id} content="준비 중">{card}</Tooltip>
              ) : (
                card
              );
            })}
          </div>
        </Field>

        <Field label="파일 이름">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => onName(e.target.value)}
              spellCheck={false}
              aria-label="파일 이름"
              className="h-9 min-w-0 flex-1 rounded-md bg-surface-3 px-2.5 text-[13px] text-foreground outline-none ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">.{PROJECT_FILE_EXT}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">이 버전은 프로젝트 파일을 저장하므로 이름 끝에 .{PROJECT_FILE_EXT}이 붙습니다.</p>
        </Field>

        <div className="rounded-lg bg-surface-4 p-3 text-[12px]">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">출력</span>
            <span className="truncate">{specLine(s, ctx)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-muted-foreground">길이</span>
            <span className="tabular-nums">{shortDuration(rangeSeconds(s, ctx))}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-muted-foreground">예상 용량</span>
            <span className="tabular-nums">약 {fileSize(estimateBytes(s, ctx))}</span>
          </div>
        </div>
      </div>

      <Footer left={<Button variant="ghost" leadingIcon={ArrowLeft} onClick={onBack}>이전</Button>}>
        <Button leadingIcon={Upload} onClick={onRender} disabled={name.trim().length === 0}>렌더링 시작</Button>
      </Footer>
    </>
  );
}
