import { type ReactElement, type ReactNode } from "react";
import {
  ALargeSmall,
  Bold,
  Droplet,
  Eye,
  EyeOff,
  MoveHorizontal,
  MoveVertical,
  Radius,
  RotateCw,
  Scaling,
  Square,
} from "lucide-react";
import { SizeProvider } from "#/lib/size-context";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import { EditorFrame } from "./frame";
import { BlendSelect, ColorField, FontSelect, PropField, ResetButton, SECTIONS, SELECTED_CLIP, useElement, type ElementApi, type PropKey } from "./shared";

const ICON = 12;

/**
 * Compact — everything on the 28px step, a two-column numeric grid with
 * glyph-only labels; tooltips carry the names. Maximum density, nothing
 * collapses, hairlines separate the groups.
 */
export function Compact() {
  const api = useElement();

  return (
    <EditorFrame element={api.props} panelWidth={288}>
      <SizeProvider size="compact">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2.5">
          <span className="size-1.5 rounded-full" style={{ background: SELECTED_CLIP.tint }} />
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium">{SELECTED_CLIP.label}</p>
          <span className="text-[10px] tabular-nums text-muted-foreground">T</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Group title="Transform" api={api} keys={SECTIONS.transform.keys}>
            <Grid>
              <Cell name="Position X"><PropField api={api} k="x" size="compact" prefix="X" /></Cell>
              <Cell name="Position Y"><PropField api={api} k="y" size="compact" prefix="Y" /></Cell>
              <Cell name="Scale"><PropField api={api} k="scale" size="compact" prefix={<Scaling size={ICON} />} /></Cell>
              <Cell name="Rotation"><PropField api={api} k="rotation" size="compact" prefix={<RotateCw size={ICON} />} /></Cell>
            </Grid>
          </Group>

          <Group title="Layer" api={api} keys={SECTIONS.blending.keys}>
            <Grid>
              <Cell name="Opacity"><PropField api={api} k="opacity" size="compact" prefix={<Droplet size={ICON} />} /></Cell>
              <Cell name="Blend mode"><BlendSelect api={api} size="compact" /></Cell>
            </Grid>
          </Group>

          <Group title="Text" api={api} keys={SECTIONS.typography.keys}>
            <div className="mb-1"><FontSelect api={api} size="compact" /></div>
            <Grid>
              <Cell name="Font size"><PropField api={api} k="fontSize" size="compact" prefix={<ALargeSmall size={ICON} />} /></Cell>
              <Cell name="Weight"><PropField api={api} k="weight" size="compact" prefix={<Bold size={ICON} />} /></Cell>
              <Cell name="Letter spacing"><PropField api={api} k="letterSpacing" size="compact" prefix={<MoveHorizontal size={ICON} />} /></Cell>
              <Cell name="Line height"><PropField api={api} k="lineHeight" size="compact" prefix={<MoveVertical size={ICON} />} /></Cell>
            </Grid>
            <div className="mt-1"><ColorField api={api} k="color" size="compact" /></div>
          </Group>

          <Group
            title="Fill"
            api={api}
            keys={SECTIONS.background.keys}
            trailing={
              <Tooltip content={api.props.fillEnabled ? "Hide background" : "Show background"} side="bottom">
                <button
                  type="button"
                  aria-label={api.props.fillEnabled ? "Hide background" : "Show background"}
                  aria-pressed={api.props.fillEnabled}
                  onClick={() => api.set("fillEnabled", !api.props.fillEnabled)}
                  className="grid size-5 place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-80 hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                >
                  {api.props.fillEnabled ? <Eye size={ICON} /> : <EyeOff size={ICON} />}
                </button>
              </Tooltip>
            }
          >
            <div className={cn("transition-opacity duration-150", !api.props.fillEnabled && "pointer-events-none opacity-40")}>
              <div className="mb-1"><ColorField api={api} k="fill" size="compact" /></div>
              <Grid>
                <Cell name="Padding"><PropField api={api} k="fillPadding" size="compact" prefix={<Square size={ICON} />} /></Cell>
                <Cell name="Corner radius"><PropField api={api} k="fillRadius" size="compact" prefix={<Radius size={ICON} />} /></Cell>
              </Grid>
            </div>
          </Group>
        </div>
      </SizeProvider>
    </EditorFrame>
  );
}

function Group({
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
    <section className="border-b border-border px-2 pb-2 pt-1.5 last:border-b-0">
      <header className="mb-1 flex h-6 items-center gap-1">
        <h3 className="flex-1 text-[11px] font-medium text-foreground/80">{title}</h3>
        {trailing}
        <ResetButton compact onClick={() => api.reset(keys)} disabled={api.isDefault(keys)} />
      </header>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-1">{children}</div>;
}

/** Glyph-labelled cell: the name lives in the tooltip. */
function Cell({ name, children }: { name: string; children: ReactElement }) {
  return (
    <Tooltip content={name} side="bottom">
      <div className="min-w-0">{children}</div>
    </Tooltip>
  );
}
