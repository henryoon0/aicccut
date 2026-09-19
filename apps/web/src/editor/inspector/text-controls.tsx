/**
 * Typography controls shared by the inspector's Typography card and the Text
 * rail panel: font field (opens the browser), metrics, alignment and colour.
 * Every edit goes straight to `setClipText`; scrubs preview then commit.
 */
import { useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Italic } from "lucide-react";
import { Button } from "#/components/ui/button";
import { ColorPickerPopover, ColorSwatch } from "#/components/ui/color-picker";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { DEFAULT_TEXT_STYLE, TEXT_SWATCHES, WEIGHT_LABEL, type ClipText, type TextAlign } from "#/editor/core";
import { cn } from "#/lib/utils";
import { FontPickerDialog } from "./font-browser";
import { fontFamilyFor } from "./fonts";
import { NumberField } from "./number-field";
import { Field } from "./shared";

export interface TextApi {
  text: ClipText;
  /** Patch the clip's text; `preview` skips history until `commit()`. */
  patch: (p: Partial<ClipText>, preview?: boolean) => void;
  commit: () => void;
}

/** Font name rendered in its own family; opens the browser dialog. */
export function FontField({ api }: { api: TextApi }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full min-w-0 items-center gap-2 rounded-md bg-surface-3 px-2.5 text-left shadow-surface-2 outline-none",
          "transition-colors duration-80 hover:bg-surface-4 focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-[13px]" style={{ fontFamily: fontFamilyFor(api.text.font) }}>
          {api.text.font}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">Browse</span>
      </button>
      <FontPickerDialog
        open={open}
        onOpenChange={setOpen}
        value={api.text.font}
        previewText={api.text.content}
        onChange={(font) => api.patch({ font })}
      />
    </>
  );
}

/** Size, leading, tracking and weight as scrubbable fields. */
export function TextMetrics({ api }: { api: TextApi }) {
  const { text } = api;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Size">
        <NumberField
          label="Font size"
          value={text.size}
          min={8}
          max={400}
          step={1}
          suffix="px"
          onChange={(size) => api.patch({ size }, true)}
          onCommit={api.commit}
        />
      </Field>
      <Field label="Weight">
        <NumberField
          label="Weight"
          value={text.weight}
          min={100}
          max={900}
          step={100}
          onChange={(weight) => api.patch({ weight }, true)}
          onCommit={api.commit}
        />
      </Field>
      <Field label="Tracking">
        {/* Stored as em × 100; shown and typed in em. */}
        <NumberField
          label="Letter spacing"
          value={text.tracking / 100}
          min={-0.2}
          max={0.4}
          step={0.01}
          precision={2}
          suffix="em"
          onChange={(v) => api.patch({ tracking: Math.round(v * 100) }, true)}
          onCommit={api.commit}
        />
      </Field>
      <Field label="Leading">
        {/* Stored as a unitless multiple × 100. */}
        <NumberField
          label="Line height"
          value={text.leading / 100}
          min={0.7}
          max={2.5}
          step={0.05}
          precision={2}
          onChange={(v) => api.patch({ leading: Math.round(v * 100) }, true)}
          onCommit={api.commit}
        />
      </Field>
    </div>
  );
}

export function AlignTabs({ value, onChange, className }: { value: TextAlign; onChange: (a: TextAlign) => void; className?: string }) {
  return (
    <Tabs size="compact" value={value} onValueChange={(v) => onChange(v as TextAlign)} className={className}>
      <TabsList aria-label="Alignment">
        <TabItem value="left" icon={AlignLeft} label="Left" />
        <TabItem value="center" icon={AlignCenter} label="Center" />
        <TabItem value="right" icon={AlignRight} label="Right" />
      </TabsList>
    </Tabs>
  );
}

/** Alignment tabs with the italic toggle beside them. */
export function AlignRow({ api }: { api: TextApi }) {
  return (
    <div className="flex items-center gap-2">
      <AlignTabs value={api.text.align} onChange={(align) => api.patch({ align })} />
      <Button
        size="icon-compact"
        variant={api.text.italic ? "secondary" : "ghost"}
        active={api.text.italic}
        aria-label="Italic"
        aria-pressed={api.text.italic}
        onClick={() => api.patch({ italic: !api.text.italic })}
      >
        <Italic />
      </Button>
    </div>
  );
}

/** Swatch strip plus a full picker for anything outside it. */
export function ColorRow({ api }: { api: TextApi }) {
  const current = api.text.color.toUpperCase();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {TEXT_SWATCHES.map((c) => (
          <ColorSwatch key={c} color={c} size={24} selected={current === c.toUpperCase()} onClick={() => api.patch({ color: c })} />
        ))}
      </div>
      <ColorPickerPopover
        value={api.text.color}
        onValueChange={(color) => api.patch({ color })}
        defaultFormat="hex"
        swatches={TEXT_SWATCHES}
        triggerShowValue
        triggerClassName="w-full"
      />
    </div>
  );
}

/** Weight name for the current numeric weight, e.g. "Bold". */
export function weightLabel(weight: number): string {
  return WEIGHT_LABEL[Math.round(weight / 100) * 100] ?? String(weight);
}

/** True when every style field still matches the default text style. */
export function isDefaultTextStyle(text: ClipText): boolean {
  return (Object.keys(DEFAULT_TEXT_STYLE) as (keyof typeof DEFAULT_TEXT_STYLE)[]).every((k) => text[k] === DEFAULT_TEXT_STYLE[k]);
}
