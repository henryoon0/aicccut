import { type ReactNode } from "react";
import { Slider } from "#/components/ui/slider";
import { Switch } from "#/components/ui/switch";
import { ColorSwatch } from "#/components/ui/color-picker";
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

const TEXT_SWATCHES = ["#FFFFFF", "#FEF148", "#FF6B6B", "#2EC4B6", "#5B6CFF", "#F4A261", "#C77DFF", "#0B0B0F"];
const FILL_SWATCHES = ["#0B0B0F", "#1E1E1E", "#3A86FF", "#7209B7", "#EF476F", "#06D6A0", "#FFD166", "#FFFFFF"];

/**
 * Cards — each section is a raised card with generous padding. Sliders for
 * bounded values (opacity, scale, rotation), a swatch strip for colours,
 * numbers only where a slider makes no sense. Friendlier, roomier.
 */
export function Cards() {
  const api = useElement();
  const p = api.props;

  return (
    <EditorFrame element={p} panelWidth={360}>
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="grid size-7 place-items-center rounded-lg text-[12px] font-bold text-black" style={{ background: SELECTED_CLIP.tint }}>T</span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-medium">{SELECTED_CLIP.label}</p>
          <p className="text-[11px] text-muted-foreground">Text layer</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <Card title="Transform" api={api} keys={SECTIONS.transform.keys}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="X"><PropField api={api} k="x" /></Field>
            <Field label="Y"><PropField api={api} k="y" /></Field>
          </div>
          <Slider label="Scale" value={p.scale} onChange={(v) => api.set("scale", v as number)} min={10} max={300} step={1} showValue valuePosition="top" formatValue={(v) => `${v}%`} />
          <Slider label="Rotation" value={p.rotation} onChange={(v) => api.set("rotation", v as number)} min={-180} max={180} step={1} showValue valuePosition="top" formatValue={(v) => `${v}°`} />
        </Card>

        <Card title="Blending" api={api} keys={SECTIONS.blending.keys}>
          <Slider label="Opacity" value={p.opacity} onChange={(v) => api.set("opacity", v as number)} min={0} max={100} step={1} showValue valuePosition="top" formatValue={(v) => `${v}%`} />
          <Field label="Blend mode"><BlendSelect api={api} /></Field>
        </Card>

        <Card title="Typography" api={api} keys={SECTIONS.typography.keys}>
          <Field label="Font"><FontSelect api={api} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size"><PropField api={api} k="fontSize" suffix="px" /></Field>
            <Field label="Weight"><PropField api={api} k="weight" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Letter spacing"><PropField api={api} k="letterSpacing" suffix="px" /></Field>
            <Field label="Line height"><PropField api={api} k="lineHeight" /></Field>
          </div>
          <Field label="Color">
            <Swatches api={api} k="color" colors={TEXT_SWATCHES} />
          </Field>
        </Card>

        <Card
          title="Background"
          api={api}
          keys={SECTIONS.background.keys}
          trailing={<Switch label="Background" checked={p.fillEnabled} onToggle={() => api.set("fillEnabled", !p.fillEnabled)} />}
        >
          <div className={cn("flex flex-col gap-4 transition-opacity duration-150", !p.fillEnabled && "pointer-events-none opacity-40")}>
            <Field label="Fill">
              <Swatches api={api} k="fill" colors={FILL_SWATCHES} />
            </Field>
            <Slider label="Padding" value={p.fillPadding} onChange={(v) => api.set("fillPadding", v as number)} min={0} max={120} step={1} showValue valuePosition="top" formatValue={(v) => `${v}px`} />
            <Slider label="Radius" value={p.fillRadius} onChange={(v) => api.set("fillRadius", v as number)} min={0} max={80} step={1} showValue valuePosition="top" formatValue={(v) => `${v}px`} />
          </div>
        </Card>
      </div>
    </EditorFrame>
  );
}

function Card({
  title,
  api,
  keys,
  trailing,
  children,
}: {
  title: string;
  api: ElementApi;
  keys: readonly PropKey[];
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface-3 p-4 shadow-surface-2">
      <header className="flex items-center gap-2">
        <h3 className="flex-1 text-[13px] font-semibold">{title}</h3>
        {trailing}
        <ResetButton onClick={() => api.reset(keys)} disabled={api.isDefault(keys)} />
      </header>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Big swatch strip plus a full picker for anything outside it. */
function Swatches({ api, k, colors }: { api: ElementApi; k: "color" | "fill"; colors: string[] }) {
  const current = api.props[k].toUpperCase();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <ColorSwatch key={c} color={c} size={32} selected={current === c} onClick={() => api.set(k, c)} />
        ))}
      </div>
      <ColorField api={api} k={k} />
    </div>
  );
}
