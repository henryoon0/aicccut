import { useState } from "react";
import { Type as TypeIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "#/components/ui/accordion";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/utils";
import { EditorFrame } from "./frame";
import {
  BlendSelect,
  ColorField,
  FontSelect,
  PropField,
  ResetButton,
  Row,
  SECTIONS,
  SELECTED_CLIP,
  useElement,
  type SectionId,
} from "./shared";

const ORDER: SectionId[] = ["transform", "blending", "typography", "background"];

/**
 * Sections — one fluid Accordion, every section collapsible, label-left
 * value-right rows, a reset button living in each section header.
 */
export function Sections() {
  const api = useElement();
  const [open, setOpen] = useState<string[]>(["transform", "typography"]);

  return (
    <EditorFrame element={api.props} panelWidth={320}>
      <PanelHeader />
      <ScrollArea className="min-h-0 flex-1">
        <Accordion type="multiple" value={open} onValueChange={(v: string[]) => setOpen(v)} className="px-2 py-2">
          {ORDER.map((id, i) => {
            const section = SECTIONS[id];
            return (
              <AccordionItem key={id} value={id} index={i} className="relative">
                <AccordionTrigger className="pr-9">
                  <span className="flex flex-1 items-center gap-2 text-left text-[13px] font-medium">
                    {section.title}
                    {!api.isDefault(section.keys) && (
                      <span aria-hidden className="size-1.5 rounded-full bg-[#6B97FF]" />
                    )}
                  </span>
                </AccordionTrigger>
                <div className="absolute right-2 top-1.5 z-20">
                  <ResetButton onClick={() => api.reset(section.keys)} disabled={api.isDefault(section.keys)} />
                </div>
                <AccordionContent>
                  <div className="flex flex-col gap-2 pb-3 pt-1">
                    <SectionBody id={id} api={api} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </EditorFrame>
  );
}

function PanelHeader() {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
      <span className="grid size-6 place-items-center rounded-md" style={{ background: SELECTED_CLIP.tint }}>
        <TypeIcon size={13} className="text-black" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[12px] font-medium">{SELECTED_CLIP.label}</p>
        <p className="text-[10px] text-muted-foreground">Text · {SELECTED_CLIP.duration.toFixed(1)}s</p>
      </div>
    </div>
  );
}

function SectionBody({ id, api }: { id: SectionId; api: ReturnType<typeof useElement> }) {
  switch (id) {
    case "transform":
      return (
        <>
          <Row compact label="Position">
            <div className="grid grid-cols-2 gap-1.5">
              <PropField api={api} k="x" prefix="X" />
              <PropField api={api} k="y" prefix="Y" />
            </div>
          </Row>
          <Row compact label="Scale"><PropField api={api} k="scale" /></Row>
          <Row compact label="Rotation"><PropField api={api} k="rotation" /></Row>
        </>
      );
    case "blending":
      return (
        <>
          <Row compact label="Opacity"><PropField api={api} k="opacity" /></Row>
          <Row compact label="Blend mode"><BlendSelect api={api} /></Row>
        </>
      );
    case "typography":
      return (
        <>
          <Row compact label="Font"><FontSelect api={api} /></Row>
          <Row compact label="Size / Weight">
            <div className="grid grid-cols-2 gap-1.5">
              <PropField api={api} k="fontSize" suffix="px" />
              <PropField api={api} k="weight" />
            </div>
          </Row>
          <Row compact label="Spacing">
            <div className="grid grid-cols-2 gap-1.5">
              <PropField api={api} k="letterSpacing" prefix="Aa" />
              <PropField api={api} k="lineHeight" prefix="↕" />
            </div>
          </Row>
          <Row compact label="Color"><ColorField api={api} k="color" /></Row>
        </>
      );
    case "background":
      return (
        <>
          <Row compact label="Fill">
            <Switch label="Show background" checked={api.props.fillEnabled} onToggle={() => api.set("fillEnabled", !api.props.fillEnabled)} />
          </Row>
          <div className={cn("flex flex-col gap-2 transition-opacity duration-150", !api.props.fillEnabled && "pointer-events-none opacity-40")}>
            <Row compact label="Color"><ColorField api={api} k="fill" /></Row>
            <Row compact label="Padding / Radius">
              <div className="grid grid-cols-2 gap-1.5">
                <PropField api={api} k="fillPadding" suffix="px" />
                <PropField api={api} k="fillRadius" suffix="px" />
              </div>
            </Row>
          </div>
        </>
      );
  }
}
