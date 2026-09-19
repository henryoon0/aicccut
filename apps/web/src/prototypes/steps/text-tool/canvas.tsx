import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bold, ChevronDown, Italic, Minus, Plus, Type } from "lucide-react";
import { Button } from "#/components/ui/button";
import { ColorPickerPopover } from "#/components/ui/color-picker";
import {
  DropdownContent,
  DropdownLabel,
  DropdownMenu,
  DropdownSearch,
  DropdownTrigger,
} from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { Tooltip } from "#/components/ui/tooltip";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { AlignCycle } from "./controls";
import { Canvas as CanvasFrame, EditorFrame, TextElement, type Rect } from "./frame";
import { FONT_CATALOGUE, SWATCHES, fontFamilyFor, useTextElement } from "./shared";

const PAGE = 40;

/**
 * Canvas — WYSIWYG. Click the text to select, double-click to type in
 * place. A floating toolbar hovers above the selection; there is no panel.
 */
export function Canvas() {
  const { text, update } = useTextElement();
  const [selected, setSelected] = useState(true);
  const [editing, setEditing] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const onLayout = useCallback((r: Rect) => setRect(r), []);

  const deselect = () => { setSelected(false); setEditing(false); };
  const bump = (d: number) => update((p) => ({ size: Math.min(400, Math.max(8, p.size + d)) }));

  return (
    <EditorFrame
      above={
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-[11px] text-muted-foreground">
          <Type size={13} strokeWidth={1.75} />
          {editing ? "Typing on canvas · Esc to finish" : selected ? "Text selected · double-click to edit, drag to move" : "Click the text on the canvas to edit it"}
        </div>
      }
    >
      <CanvasFrame
        onBackgroundClick={deselect}
        overlay={
          <AnimatePresence>
            {selected && rect && (
              <FloatingToolbar key="tb" rect={rect}>
                <FontMenu value={text.font} onChange={(font) => update({ font })} />
                <Divider />
                <Tooltip content="Smaller" side="bottom"><Button size="icon-compact" variant="ghost" aria-label="Decrease size" onClick={() => bump(-4)}><Minus /></Button></Tooltip>
                <span className="w-9 text-center text-[12px] tabular-nums">{text.size}</span>
                <Tooltip content="Larger" side="bottom"><Button size="icon-compact" variant="ghost" aria-label="Increase size" onClick={() => bump(4)}><Plus /></Button></Tooltip>
                <Divider />
                <Button size="icon-compact" variant="ghost" active={text.weight >= 700} aria-pressed={text.weight >= 700} aria-label="Bold" onClick={() => update((p) => ({ weight: p.weight >= 700 ? 400 : 700 }))}><Bold /></Button>
                <Button size="icon-compact" variant="ghost" active={text.italic} aria-pressed={text.italic} aria-label="Italic" onClick={() => update((p) => ({ italic: !p.italic }))}><Italic /></Button>
                <AlignCycle value={text.align} onChange={(align) => update({ align })} />
                <Divider />
                <ColorPickerPopover size="compact" value={text.color} swatches={SWATCHES} triggerShowValue={false} onValueChange={(color) => update({ color })} />
              </FloatingToolbar>
            )}
          </AnimatePresence>
        }
      >
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
              onLayout={onLayout}
            />
        )}
      </CanvasFrame>
    </EditorFrame>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-border" />;
}

function FloatingToolbar({ rect, children }: { rect: Rect; children: ReactNode }) {
  const canvasW = rect.canvasWidth;
  const H = 36;
  const above = rect.top - H - 10 > 4;
  const top = above ? rect.top - H - 10 : rect.top + rect.height + 10;
  const centre = rect.left + rect.width / 2;
  const width = 420;
  const left = Math.max(8, Math.min(canvasW - width - 8, centre - width / 2));
  return (
    <motion.div
      role="toolbar"
      aria-label="Text formatting"
      className="absolute z-20 flex h-9 items-center gap-0.5 rounded-lg border border-border bg-surface-4 px-1 shadow-surface-4"
      style={{ top, left, width, transformOrigin: above ? "50% 100%" : "50% 0%" }}
      initial={{ opacity: 0, scale: 0.96, y: above ? 4 : -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: above ? 4 : -4 }}
      transition={spring.moderate}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  );
}

function FontMenu({ value, onChange }: { value: string; onChange: (font: string) => void }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? FONT_CATALOGUE.filter((f) => f.name.toLowerCase().includes(q)) : FONT_CATALOGUE;
  }, [query]);
  const shown = matches.slice(0, PAGE * page);
  const checkedIndex = shown.findIndex((f) => f.name === value);

  return (
    <DropdownMenu size="compact" onOpenChange={(o) => { if (!o) setPage(1); }}>
      <DropdownTrigger
        render={
          <button type="button" className={cn("flex h-7 max-w-[150px] items-center gap-1 rounded-md px-2 text-[12px] hover:bg-hover active:bg-active outline-none focus-visible:ring-2 focus-visible:ring-ring/40")}>
            <span className="truncate" style={{ fontFamily: fontFamilyFor(value) }}>{value}</span>
            <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <DropdownContent className="w-[260px]" checkedIndex={checkedIndex >= 0 ? checkedIndex : undefined}>
        <DropdownSearch value={query} onValueChange={(v) => { setQuery(v); setPage(1); }} placeholder="Search 1,000+ fonts…" />
        <div className="max-h-[300px] overflow-y-auto">
          {shown.map((f, i) => (
            <MenuItem
              key={f.id}
              index={i}
              label={f.name}
              checked={f.name === value}
              onSelect={() => onChange(f.name)}
              style={{ fontFamily: fontFamilyFor(f.name) }}
            />
          ))}
          {shown.length < matches.length && (
            <button
              type="button"
              className="flex h-7 w-full items-center justify-center text-[11px] text-muted-foreground hover:bg-hover"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPage((p) => p + 1); }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Show {Math.min(PAGE, matches.length - shown.length)} more · {matches.length.toLocaleString()} total
            </button>
          )}
          {matches.length === 0 && <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">No fonts match</div>}
        </div>
        <DropdownLabel>{shown.length} of {matches.length.toLocaleString()}</DropdownLabel>
      </DropdownContent>
    </DropdownMenu>
  );
}
