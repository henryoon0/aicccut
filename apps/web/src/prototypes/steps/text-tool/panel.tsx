import { useMemo, useRef, useState } from "react";
import { Plus, Type } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "#/components/ui/combobox";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";
import { StyleControls } from "./controls";
import { Canvas, EditorFrame, TextElement } from "./frame";
import { CATEGORY_TINT, FONT_BY_NAME, FONT_CATALOGUE, FieldLabel, fontFamilyFor, useTextElement } from "./shared";

/**
 * Panel — everything lives in a right-side text panel. The canvas only
 * shows the result; double-clicking it drops you into the textarea.
 */
export function Panel() {
  const { text, update } = useTextElement();
  const [selected, setSelected] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fontItems = useMemo(() => FONT_CATALOGUE.map((f) => ({ value: f.name, label: f.name })), []);
  const current = FONT_BY_NAME.get(text.font);

  const focusContent = () => {
    setSelected(true);
    const el = textareaRef.current;
    el?.focus();
    el?.select();
  };

  return (
    <EditorFrame
      right={
        <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-surface-2">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
            <div className="flex items-center gap-1.5 text-[12px] font-medium"><Type size={14} strokeWidth={1.75} /> Text</div>
            <Button size="compact" variant="ghost" leadingIcon={Plus} onClick={() => update({ content: "새 텍스트" })}>Add</Button>
          </div>
          <ScrollArea className="min-h-0 w-[300px] flex-1">
            <div className={cn("flex w-[300px] flex-col gap-5 p-3 transition-opacity", !selected && "opacity-50")}>
              <section className="flex flex-col gap-2">
                <FieldLabel>Content</FieldLabel>
                <Textarea
                  ref={textareaRef}
                  value={text.content}
                  onChange={(e) => update({ content: e.target.value })}
                  onFocus={() => setSelected(true)}
                  className="min-h-[72px] bg-surface-3 text-[13px] leading-relaxed"
                  placeholder="Type your text…"
                />
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <FieldLabel>Font</FieldLabel>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{FONT_CATALOGUE.length.toLocaleString()} fonts</span>
                </div>
                <Combobox size="compact" items={fontItems} value={text.font} onValueChange={(v) => v && update({ font: v })}>
                  <ComboboxInput placeholder="Search fonts…" clearable />
                  <ComboboxContent className="w-[276px]">
                    <ComboboxList className="max-h-[320px]">
                      {(item) => {
                        const name = typeof item === "string" ? item : item.value;
                        const meta = FONT_BY_NAME.get(name);
                        return (
                          <ComboboxItem key={name} value={name}>
                            <span className="flex items-center gap-2">
                              <span className="truncate" style={{ fontFamily: fontFamilyFor(name) }}>{name}</span>
                              {meta && <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide" style={{ color: CATEGORY_TINT[meta.category] }}>{meta.category}</span>}
                            </span>
                          </ComboboxItem>
                        );
                      }}
                    </ComboboxList>
                    <ComboboxEmpty>No fonts match</ComboboxEmpty>
                  </ComboboxContent>
                </Combobox>
                {current && (
                  <div className="flex items-center justify-between rounded-md bg-surface-3 px-2 py-1.5 text-[11px] text-muted-foreground">
                    <span>{current.category} · {current.styles} {current.styles === 1 ? "style" : "styles"}</span>
                    <span className="truncate" style={{ fontFamily: fontFamilyFor(current.name), fontSize: 13, color: "var(--foreground)" }}>가나다 Aa</span>
                  </div>
                )}
              </section>

              <StyleControls text={text} update={update} />
            </div>
          </ScrollArea>
        </aside>
      }
    >
      <Canvas onBackgroundClick={() => setSelected(false)} onDoubleClick={focusContent}>
        {(scale, ref) => (
          <TextElement
            text={text}
            scale={scale}
            canvasRef={ref}
            selected={selected}
            onSelect={() => setSelected(true)}
            onMove={(x, y) => update({ x, y })}
            onStartEdit={focusContent}
          />
        )}
      </Canvas>
    </EditorFrame>
  );
}
