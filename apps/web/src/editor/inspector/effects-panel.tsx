/**
 * EffectsPanel — the "Effects" rail flyout. The catalogue as cards; clicking
 * one appends it to the selected clip. Two entries are listed but not yet
 * applicable, so they stay disabled rather than pretending to work.
 */
import { Tooltip } from "#/components/ui/tooltip";
import { EFFECTS, EFFECT_DEFAULTS, useActions } from "#/editor/core";
import { cn } from "#/lib/utils";
import { EFFECT_COPY, EFFECT_META, isEffectType } from "./effect-meta";
import { useSelectedClip } from "./shared";

export function EffectsPanel() {
  const actions = useActions();
  const clip = useSelectedClip();

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-surface-2">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <p className="px-0.5 text-[11px] text-muted-foreground">
          {clip ? `추가 대상: ${clip.label}` : "클립을 먼저 선택하세요"}
        </p>

        {EFFECTS.map((fx) => {
          const type = isEffectType(fx.id) ? fx.id : null;
          const disabled = !type || !clip;
          const reason = !type ? "아직 준비 중" : !clip ? "클립을 먼저 선택하세요" : "";
          const card = (
            <button
              type="button"
              disabled={disabled}
              onClick={() => clip && type && actions.addEffect(clip.id, type)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-lg bg-surface-3 p-3 text-left shadow-surface-2 outline-none",
                "transition-colors duration-80 focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                disabled ? "cursor-not-allowed opacity-40" : "hover:bg-surface-4 active:bg-active",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-medium">{EFFECT_COPY[fx.id].name}</span>
                {type && (
                  <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {EFFECT_DEFAULTS[type][EFFECT_META[type].param]}
                    {EFFECT_META[type].suffix ?? ""}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-muted-foreground">{EFFECT_COPY[fx.id].description}</span>
            </button>
          );
          return disabled ? (
            <Tooltip key={fx.id} content={reason} side="left">
              <span className="block">{card}</span>
            </Tooltip>
          ) : (
            <div key={fx.id}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
