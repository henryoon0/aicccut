import { useMemo, useState } from "react";
import { Bold, Italic, MoreHorizontal } from "lucide-react";
import { Button } from "#/components/ui/button";
import { ColorPickerPopover } from "#/components/ui/color-picker";
import { DropdownContent, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "#/components/ui/select";
import { FONTS } from "#/prototypes/mock";
import { AlignCycle } from "./controls";
import { Canvas, EditorFrame, TextElement } from "./frame";
import { SWATCHES, ScrubNumber, categoryOf, fontFamilyFor, useTextElement, type FontCategory } from "./shared";

const TRACKING = [
  { label: "Tight", value: -4 },
  { label: "Normal", value: 0 },
  { label: "Wide", value: 8 },
  { label: "Extra wide", value: 16 },
];
const LEADING = [
  { label: "Compact 1.0", value: 100 },
  { label: "Default 1.2", value: 120 },
  { label: "Relaxed 1.5", value: 150 },
];
const ORDER: FontCategory[] = ["Korean", "Sans", "Serif", "Display", "Mono"];

/**
 * Minimal — one toolbar line above the canvas, nothing else. Type straight
 * on the canvas; spacing hides behind More.
 */
export function Minimal() {
  const { text, update } = useTextElement();
  const [selected, setSelected] = useState(true);
  const [editing, setEditing] = useState(false);

  const groups = useMemo(() => {
    const byCat = new Map<FontCategory, string[]>();
    for (const f of FONTS) {
      const c = categoryOf(f);
      byCat.set(c, [...(byCat.get(c) ?? []), f]);
    }
    let index = 0;
    return ORDER.filter((c) => byCat.has(c)).map((c) => ({ category: c, fonts: byCat.get(c)!.map((name) => ({ name, index: index++ })) }));
  }, []);

  const trackingIdx = TRACKING.findIndex((t) => t.value === text.tracking);
  const leadingIdx = LEADING.findIndex((l) => l.value === text.leading);
  const checked = [trackingIdx, leadingIdx >= 0 ? TRACKING.length + leadingIdx : -1].filter((i) => i >= 0);

  return (
    <EditorFrame
      above={
        <div role="toolbar" aria-label="Text" className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-3">
          <Select size="compact" value={text.font} onValueChange={(font) => update({ font })}>
            <SelectTrigger className="w-[200px]" />
            <SelectContent>
              {groups.map((g) => (
                <SelectGroup key={g.category}>
                  <SelectLabel>{g.category}</SelectLabel>
                  {g.fonts.map((f) => (
                    <SelectItem key={f.name} index={f.index} value={f.name}>
                      <span style={{ fontFamily: fontFamilyFor(f.name) }}>{f.name}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <ScrubNumber compact label="" value={text.size} min={8} max={400} suffix="px" onChange={(size) => update({ size })} className="w-[84px]" />
          <span className="mx-1 h-4 w-px bg-border" />
          <Button size="icon-compact" variant="ghost" active={text.weight >= 700} aria-pressed={text.weight >= 700} aria-label="Bold" onClick={() => update((p) => ({ weight: p.weight >= 700 ? 400 : 700 }))}><Bold /></Button>
          <Button size="icon-compact" variant="ghost" active={text.italic} aria-pressed={text.italic} aria-label="Italic" onClick={() => update((p) => ({ italic: !p.italic }))}><Italic /></Button>
          <AlignCycle value={text.align} onChange={(align) => update({ align })} />
          <span className="mx-1 h-4 w-px bg-border" />
          <ColorPickerPopover size="compact" value={text.color} swatches={SWATCHES} triggerShowValue={false} onValueChange={(color) => update({ color })} />
          <DropdownMenu size="compact">
            <DropdownTrigger render={<Button size="compact" variant="ghost" trailingIcon={MoreHorizontal}>More</Button>} />
            <DropdownContent className="w-[200px]" checkedIndices={checked}>
              <DropdownLabel>Letter spacing</DropdownLabel>
              {TRACKING.map((t, i) => (
                <MenuItem key={t.label} index={i} label={t.label} checked={text.tracking === t.value} closeOnClick={false} onSelect={() => update({ tracking: t.value })} />
              ))}
              <DropdownSeparator />
              <DropdownLabel>Line height</DropdownLabel>
              {LEADING.map((l, i) => (
                <MenuItem key={l.label} index={TRACKING.length + i} label={l.label} checked={text.leading === l.value} closeOnClick={false} onSelect={() => update({ leading: l.value })} />
              ))}
            </DropdownContent>
          </DropdownMenu>
          <span className="ml-auto text-[11px] text-muted-foreground">{editing ? "Esc to finish" : "Double-click text to type"}</span>
        </div>
      }
    >
      <Canvas onBackgroundClick={() => { setSelected(false); setEditing(false); }}>
        {(scale, ref) => (
          <TextElement
            text={text}
            scale={scale}
            canvasRef={ref}
            selected={selected}
            editing={editing}
            onSelect={() => setSelected(true)}
            onMove={(x, y) => update({ x, y })}
            onStartEdit={() => { setSelected(true); setEditing(true); }}
            onEdit={(content) => update({ content })}
            onEndEdit={() => setEditing(false)}
          />
        )}
      </Canvas>
    </EditorFrame>
  );
}
