/**
 * The Effects card of the inspector: the clip's effect stack, each with an
 * enable switch, its parameter, reorder and remove. Blur routes through the
 * `blur` channel so it can be keyframed like a transform property.
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { DropdownContent, DropdownMenu, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { Slider } from "#/components/ui/slider";
import { Switch } from "#/components/ui/switch";
import { Tooltip } from "#/components/ui/tooltip";
import { EFFECTS, useActions, type Clip, type EffectInstance } from "#/editor/core";
import { cn } from "#/lib/utils";
import { ChannelSlider, type ChannelApi } from "./channels";
import { EFFECT_META, isEffectType } from "./effect-meta";
import { NumberField } from "./number-field";
import { Card, ScrubRegion } from "./shared";

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-80",
          "hover:bg-hover hover:text-foreground active:bg-active focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          "disabled:pointer-events-none disabled:opacity-30",
          danger && "hover:text-destructive",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** A non-keyframeable effect parameter: readout plus slider. */
function ParamSlider({ clipId, effect }: { clipId: string; effect: EffectInstance }) {
  const actions = useActions();
  const meta = EFFECT_META[effect.type];
  const value = effect.params[meta.param] ?? 0;
  const set = (v: number, preview?: boolean) => actions.updateEffect(clipId, effect.id, { [meta.param]: v }, preview ? { preview: true } : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">Amount</span>
        <NumberField
          label={`${meta.label} amount`}
          value={value}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          precision={meta.precision}
          suffix={meta.suffix}
          align="right"
          size="compact"
          variant="bare"
          className="w-[76px] shrink-0"
          onChange={(v) => set(v, true)}
          onCommit={() => actions.commit()}
        />
      </div>
      <ScrubRegion>
        <Slider
          aria-label={`${meta.label} amount`}
          value={value}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          showValue={false}
          onChange={(v) => typeof v === "number" && set(v, true)}
        />
      </ScrubRegion>
    </div>
  );
}

export function EffectsCard({ clip, api }: { clip: Clip; api: ChannelApi }) {
  const actions = useActions();
  const effects = clip.props.effects;
  // Only the catalogue entries the document model can actually hold.
  const catalogue = EFFECTS.flatMap((fx) => (isEffectType(fx.id) ? [{ type: fx.id, name: fx.name }] : []));

  return (
    <Card
      title="Effects"
      onReset={() => {
        for (const e of effects) actions.removeEffect(clip.id, e.id);
      }}
      resetDisabled={effects.length === 0}
      trailing={
        <DropdownMenu size="compact">
          <DropdownTrigger
            render={
              <Button variant="ghost" size="compact" leadingIcon={Plus}>
                Add effect
              </Button>
            }
          />
          <DropdownContent align="end" className="min-w-44">
            {catalogue.map((fx, i) => (
              <MenuItem key={fx.type} index={i} label={fx.name} onSelect={() => actions.addEffect(clip.id, fx.type)} />
            ))}
          </DropdownContent>
        </DropdownMenu>
      }
    >
      {effects.length === 0 && <p className="text-[12px] text-muted-foreground">No effects on this clip.</p>}

      {effects.map((effect, i) => {
        const meta = EFFECT_META[effect.type];
        return (
          <div key={effect.id} className="flex flex-col gap-3 rounded-lg bg-surface-4 p-3">
            <header className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <Switch size="compact" label={meta.label} checked={effect.enabled} onToggle={() => actions.toggleEffect(clip.id, effect.id)} />
              </div>
              <IconButton label={`Move ${meta.label} up`} disabled={i === 0} onClick={() => actions.reorderEffects(clip.id, i, i - 1)}>
                <ArrowUp size={12} strokeWidth={1.75} />
              </IconButton>
              <IconButton label={`Move ${meta.label} down`} disabled={i === effects.length - 1} onClick={() => actions.reorderEffects(clip.id, i, i + 1)}>
                <ArrowDown size={12} strokeWidth={1.75} />
              </IconButton>
              <IconButton label={`Remove ${meta.label}`} danger onClick={() => actions.removeEffect(clip.id, effect.id)}>
                <Trash2 size={12} strokeWidth={1.75} />
              </IconButton>
            </header>
            <div className={cn("transition-opacity duration-150", !effect.enabled && "pointer-events-none opacity-40")}>
              {effect.type === "blur" ? (
                <ChannelSlider api={api} ch="blur" label="Amount" min={meta.min} max={meta.max} step={meta.step} precision={meta.precision} suffix={meta.suffix} />
              ) : (
                <ParamSlider clipId={clip.id} effect={effect} />
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
