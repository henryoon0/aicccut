import { useState } from "react";
import { motion } from "framer-motion";
import { Check, SlidersHorizontal, Sparkles } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "#/components/ui/accordion";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Textarea } from "#/components/ui/textarea";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { StyleControls } from "./controls";
import { Canvas, EditorFrame, TextElement } from "./frame";
import { DEFAULT_TEXT, FieldLabel, FontName, textCss, useTextElement, type TextStyle } from "./shared";

interface Preset {
  id: string;
  name: string;
  hint: string;
  style: Omit<TextStyle, "content">;
  /** Sample line shown on the thumbnail. */
  sample: string;
}

const PRESETS: Preset[] = [
  { id: "title", name: "Title", hint: "Opening card, centred", sample: "훅(Hook)이란 무엇인가", style: { font: "Pretendard", size: 96, weight: 800, italic: false, tracking: -3, leading: 110, color: "#FFFFFF", align: "center", x: 50, y: 50 } },
  { id: "lower-third", name: "Lower third", hint: "Speaker name, bottom-left", sample: "이재윤 · AI Coffee Chat", style: { font: "Inter", size: 44, weight: 600, italic: false, tracking: 0, leading: 120, color: "#FFD166", align: "left", x: 24, y: 84 } },
  { id: "caption", name: "Caption", hint: "Subtitle band, bottom-centre", sample: "훅은 도구 호출 앞뒤에 끼어드는 작은 스크립트예요", style: { font: "Noto Sans KR", size: 40, weight: 500, italic: false, tracking: 0, leading: 140, color: "#FFFFFF", align: "center", x: 50, y: 88 } },
  { id: "callout", name: "Callout", hint: "Label pointing at the demo", sample: "PreToolUse", style: { font: "JetBrains Mono", size: 56, weight: 700, italic: false, tracking: 4, leading: 120, color: "#2EC4B6", align: "left", x: 30, y: 30 } },
  { id: "quote", name: "Quote", hint: "Serif, wide, italic", sample: "“수료 다음 날부터 업무에 적용했어요”", style: { font: "Playfair Display", size: 72, weight: 500, italic: true, tracking: 0, leading: 125, color: "#F4F1EA", align: "center", x: 50, y: 50 } },
];

function matchesPreset(t: TextStyle, p: Preset): boolean {
  const s = p.style;
  return t.font === s.font && t.size === s.size && t.weight === s.weight && t.italic === s.italic && t.tracking === s.tracking && t.leading === s.leading && t.color === s.color && t.align === s.align;
}

/**
 * Presets — pick a role for the text (title, lower third…) from real styled
 * thumbnails; the raw controls hide behind a Customize disclosure.
 */
export function Presets() {
  const { text, update } = useTextElement({ ...DEFAULT_TEXT, ...PRESETS[0].style });
  const [selected, setSelected] = useState(true);
  const [open, setOpen] = useState<string>("");
  const active = PRESETS.find((p) => matchesPreset(text, p));

  const apply = (p: Preset) => update({ ...p.style });

  return (
    <EditorFrame
      right={
        <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-surface-2">
          <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-3 text-[12px] font-medium">
            <Sparkles size={14} strokeWidth={1.75} /> Text style
            {active ? <Badge size="sm" color="blue" className="ml-auto">{active.name}</Badge> : <Badge size="sm" className="ml-auto">Custom</Badge>}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-3">
              <section className="flex flex-col gap-2">
                <FieldLabel>Content</FieldLabel>
                <Textarea value={text.content} onChange={(e) => update({ content: e.target.value })} onFocus={() => setSelected(true)} className="min-h-[56px] bg-surface-3 text-[13px]" />
              </section>

              <section className="flex flex-col gap-2">
                <FieldLabel>Presets</FieldLabel>
                <div className="flex flex-col gap-1.5">
                  {PRESETS.map((p) => (
                    <PresetCard key={p.id} preset={p} active={active?.id === p.id} onPick={() => { apply(p); setSelected(true); }} />
                  ))}
                </div>
              </section>

              <Accordion type="single" collapsible size="compact" value={open} onValueChange={(v: string) => setOpen(v)}>
                <AccordionItem value="custom" index={0}>
                  <AccordionTrigger>
                    <span className="flex items-center gap-1.5"><SlidersHorizontal size={13} strokeWidth={1.75} /> Customize</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-4 pt-2 pb-1">
                      <section className="flex flex-col gap-2">
                        <FieldLabel>Font</FieldLabel>
                        <div className="flex items-center justify-between rounded-md border border-border bg-surface-3 px-2 py-1.5">
                          <FontName name={text.font} size={13} />
                          <span className="text-[11px] text-muted-foreground">from preset</span>
                        </div>
                      </section>
                      <StyleControls text={text} update={update} />
                      {!active && (
                        <Button size="compact" variant="tertiary" onClick={() => apply(PRESETS[0])}>Reset to Title</Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>
        </aside>
      }
    >
      <Canvas onBackgroundClick={() => setSelected(false)}>
        {(scale, ref) => (
          <TextElement text={text} scale={scale} canvasRef={ref} selected={selected} onSelect={() => setSelected(true)} onMove={(x, y) => update({ x, y })} onStartEdit={() => setOpen("custom")} />
        )}
      </Canvas>
    </EditorFrame>
  );
}

const THUMB_W = 132;

function PresetCard({ preset, active, onPick }: { preset: Preset; active: boolean; onPick: () => void }) {
  const scale = THUMB_W / 1920;
  const s = { ...preset.style, content: preset.sample };
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={cn(
        "group relative flex items-stretch gap-2.5 overflow-hidden rounded-lg border p-1.5 text-left outline-none transition-colors",
        active ? "border-[#6B97FF] bg-selected" : "border-border bg-surface-3 hover:bg-hover",
        "focus-visible:ring-2 focus-visible:ring-ring/40"
      )}
    >
      <div
        className="relative aspect-video shrink-0 overflow-hidden rounded-md"
        style={{ width: THUMB_W, background: "radial-gradient(120% 90% at 50% 110%, #2b2f6e 0%, #141631 45%, #0b0b10 100%)" }}
      >
        <div className="pointer-events-none absolute inset-x-[8%] bottom-[-6%] top-[22%] rounded-[2px] border border-white/10 bg-white/[0.03]" />
        <div
          className="absolute max-w-[94%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
          style={{ left: `${s.x}%`, top: `${s.y}%`, ...textCss(s, scale * 1.35) }}
        >
          {preset.sample}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-6">
        <div className="text-[12px] font-medium">{preset.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{preset.hint}</div>
        <FontName name={preset.style.font} size={11} className="text-muted-foreground" />
      </div>
      {active && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.moderate}
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#6B97FF] text-white"
        >
          <Check size={12} strokeWidth={2.5} />
        </motion.span>
      )}
    </button>
  );
}
