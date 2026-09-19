import { AlignCenter, AlignLeft, AlignRight, Italic } from "lucide-react";
import { Button } from "#/components/ui/button";
import { ColorPickerPopover } from "#/components/ui/color-picker";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select";
import { Tabs, TabItem, TabsList } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import { FieldLabel, ScrubNumber, SWATCHES, WEIGHT_LABEL, WEIGHTS, type Align, type TextStyle } from "./shared";

interface StyleControlsProps {
  text: TextStyle;
  update: (patch: Partial<TextStyle>) => void;
  className?: string;
  /** Hide the alignment and colour rows (when the host renders them elsewhere). */
  hideAlignColor?: boolean;
}

/** The raw typographic controls: size, weight, tracking, leading, align, colour. */
export function StyleControls({ text, update, className, hideAlignColor }: StyleControlsProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <section className="flex flex-col gap-2">
        <FieldLabel>Weight</FieldLabel>
        <div className="flex gap-2">
          <Select size="compact" value={String(text.weight)} onValueChange={(v) => update({ weight: Number(v) })}>
            <SelectTrigger className="flex-1" />
            <SelectContent>
              {WEIGHTS.map((w, i) => (
                <SelectItem key={w} index={i} value={String(w)}>
                  <span style={{ fontWeight: w }}>{WEIGHT_LABEL[w]}</span>
                  <span className="ml-1.5 text-muted-foreground tabular-nums">{w}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon-compact" variant={text.italic ? "secondary" : "ghost"} active={text.italic} aria-label="Italic" aria-pressed={text.italic} onClick={() => update({ italic: !text.italic })}>
            <Italic />
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <FieldLabel>Metrics</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <ScrubNumber compact label="Size" value={text.size} min={8} max={400} step={1} suffix="px" onChange={(size) => update({ size })} />
          <ScrubNumber compact label="Leading" value={text.leading} min={70} max={250} step={5} format={(v) => (v / 100).toFixed(2)} onChange={(leading) => update({ leading })} />
          <ScrubNumber compact label="Tracking" value={text.tracking} min={-20} max={40} step={1} sensitivity={6} format={(v) => (v / 100).toFixed(2)} suffix="em" onChange={(tracking) => update({ tracking })} />
          <ScrubNumber compact label="Weight" value={text.weight} min={100} max={900} step={100} sensitivity={12} onChange={(weight) => update({ weight })} />
        </div>
      </section>

      {!hideAlignColor && (
        <section className="flex flex-col gap-2">
          <FieldLabel>Alignment</FieldLabel>
          <AlignTabs value={text.align} onChange={(align) => update({ align })} />
          <FieldLabel className="mt-2">Colour</FieldLabel>
          <div className="flex items-center gap-2">
            <ColorPickerPopover size="compact" value={text.color} swatches={SWATCHES} triggerShowValue={false} onValueChange={(color) => update({ color })} />
            <span className="truncate text-[11px] uppercase text-muted-foreground tabular-nums">{text.color.replace("#", "")}</span>
          </div>
        </section>
      )}
    </div>
  );
}

export function AlignTabs({ value, onChange, className }: { value: Align; onChange: (a: Align) => void; className?: string }) {
  return (
    <Tabs size="compact" value={value} onValueChange={(v) => onChange(v as Align)} className={className}>
      <TabsList aria-label="Alignment">
        <TabItem value="left" icon={AlignLeft} label="Left" />
        <TabItem value="center" icon={AlignCenter} label="Center" />
        <TabItem value="right" icon={AlignRight} label="Right" />
      </TabsList>
    </Tabs>
  );
}

const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;
const ALIGN_ORDER: Align[] = ["left", "center", "right"];

/** One icon button that cycles alignment — for one-line toolbars. */
export function AlignCycle({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  const Icon = ALIGN_ICON[value];
  return (
    <Button size="icon-compact" variant="ghost" aria-label={`Align ${value}`} onClick={() => onChange(ALIGN_ORDER[(ALIGN_ORDER.indexOf(value) + 1) % 3])}>
      <Icon />
    </Button>
  );
}
