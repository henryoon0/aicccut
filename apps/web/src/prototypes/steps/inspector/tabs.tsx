import { useState, type ReactNode } from "react";
import { LayoutGrid, Palette, Type as TypeIcon } from "lucide-react";
import { TabItem, TabPanel, Tabs, TabsList } from "#/components/ui/tabs";
import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/utils";
import { EditorFrame } from "./frame";
import {
  BlendSelect,
  ColorField,
  FontSelect,
  PropField,
  ResetButton,
  SECTIONS,
  SELECTED_CLIP,
  useElement,
  type ElementApi,
  type PropKey,
} from "./shared";

type Page = "layout" | "style" | "text";

const PAGE_KEYS: Record<Page, PropKey[]> = {
  layout: SECTIONS.transform.keys,
  style: [...SECTIONS.blending.keys, ...SECTIONS.background.keys],
  text: SECTIONS.typography.keys,
};

/**
 * Tabs — a segmented control splits the panel into three dense pages.
 * Nothing collapses; you switch pages instead of scrolling.
 */
export function TabsVariant() {
  const api = useElement();
  const [page, setPage] = useState<Page>("layout");
  const keys = PAGE_KEYS[page];

  return (
    <EditorFrame element={api.props} panelWidth={320}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="size-2 rounded-full" style={{ background: SELECTED_CLIP.tint }} />
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{SELECTED_CLIP.label}</p>
        <ResetButton onClick={() => api.reset(keys)} disabled={api.isDefault(keys)} />
      </div>

      <Tabs value={page} onValueChange={(v) => setPage(v as Page)} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-3 pt-3">
          <TabsList className="w-full">
            <TabItem value="layout" label="Layout" icon={LayoutGrid} />
            <TabItem value="style" label="Style" icon={Palette} />
            <TabItem value="text" label="Text" icon={TypeIcon} />
          </TabsList>
        </div>

        <TabPanel value="layout" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <Group title="Position">
            <div className="grid grid-cols-2 gap-2">
              <Labeled label="X"><PropField api={api} k="x" /></Labeled>
              <Labeled label="Y"><PropField api={api} k="y" /></Labeled>
            </div>
          </Group>
          <Group title="Size & rotation">
            <div className="grid grid-cols-2 gap-2">
              <Labeled label="Scale"><PropField api={api} k="scale" /></Labeled>
              <Labeled label="Rotation"><PropField api={api} k="rotation" /></Labeled>
            </div>
          </Group>
          <Hint>Drag any number to scrub. Shift ×10, Alt ×0.1. Type “+20” or “*2”.</Hint>
        </TabPanel>

        <TabPanel value="style" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <Group title="Blending">
            <div className="grid grid-cols-[1fr_1.4fr] gap-2">
              <Labeled label="Opacity"><PropField api={api} k="opacity" /></Labeled>
              <Labeled label="Mode"><BlendSelect api={api} /></Labeled>
            </div>
          </Group>
          <Group
            title="Background"
            trailing={<Switch label="Background" checked={api.props.fillEnabled} onToggle={() => api.set("fillEnabled", !api.props.fillEnabled)} size="compact" />}
          >
            <div className={cn("flex flex-col gap-2 transition-opacity duration-150", !api.props.fillEnabled && "pointer-events-none opacity-40")}>
              <Labeled label="Fill"><ColorField api={api} k="fill" /></Labeled>
              <div className="grid grid-cols-2 gap-2">
                <Labeled label="Padding"><PropField api={api} k="fillPadding" suffix="px" /></Labeled>
                <Labeled label="Radius"><PropField api={api} k="fillRadius" suffix="px" /></Labeled>
              </div>
            </div>
          </Group>
        </TabPanel>

        <TabPanel value="text" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <Group title="Font">
            <FontSelect api={api} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Labeled label="Size"><PropField api={api} k="fontSize" suffix="px" /></Labeled>
              <Labeled label="Weight"><PropField api={api} k="weight" /></Labeled>
            </div>
          </Group>
          <Group title="Spacing">
            <div className="grid grid-cols-2 gap-2">
              <Labeled label="Letter"><PropField api={api} k="letterSpacing" suffix="px" /></Labeled>
              <Labeled label="Line"><PropField api={api} k="lineHeight" /></Labeled>
            </div>
          </Group>
          <Group title="Color">
            <ColorField api={api} k="color" />
            <WeightPresets api={api} />
          </Group>
        </TabPanel>
      </Tabs>
    </EditorFrame>
  );
}

function Group({ title, trailing, children }: { title: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <header className="mb-2 flex h-5 items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
        {trailing}
      </header>
      {children}
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">{children}</p>;
}

function WeightPresets({ api }: { api: ElementApi }) {
  const presets = [
    { label: "Light", weight: 300 },
    { label: "Regular", weight: 400 },
    { label: "Medium", weight: 500 },
    { label: "Bold", weight: 700 },
    { label: "Black", weight: 900 },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {presets.map((p) => (
        <button
          key={p.weight}
          type="button"
          onClick={() => api.set("weight", p.weight)}
          className={cn(
            "h-6 rounded-md px-2 text-[11px] transition-colors duration-80 outline-none",
            "hover:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
            api.props.weight === p.weight ? "bg-selected text-foreground" : "text-muted-foreground",
          )}
          style={{ fontWeight: p.weight }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
