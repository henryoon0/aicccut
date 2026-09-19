/**
 * Animatable-property rows. Each row carries a stopwatch (does this channel
 * have keyframes?), prev / add / next keyframe navigation, and the control
 * itself. Editing a value writes a keyframe at the playhead once the channel
 * is animated, and the static prop otherwise — `setChannelValue` decides.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Slider } from "#/components/ui/slider";
import {
  CHANNELS,
  evaluateClip,
  isAnimated,
  sortKfs,
  useActions,
  useEditor,
  usePlayhead,
  type Channel,
  type ChannelValues,
  type Clip,
  type Keyframe,
} from "#/editor/core";
import { cn } from "#/lib/utils";
import { NumberField } from "./number-field";
import { Diamond, ScrubRegion, Stopwatch } from "./shared";

export interface ChannelApi {
  /** Values at the playhead: keyframed channels interpolated, the rest static. */
  values: ChannelValues;
  animated: (ch: Channel) => boolean;
  keyframeHere: (ch: Channel) => Keyframe | undefined;
  /** Write a value; `preview` skips history until `commit()`. */
  set: (ch: Channel, value: number, preview?: boolean) => void;
  commit: () => void;
  /** Stopwatch: start animating at the playhead, or freeze at the current value. */
  toggle: (ch: Channel) => void;
  /** Seek to the previous / next keyframe of the channel. */
  jump: (ch: Channel, dir: 1 | -1) => void;
  /** Add a keyframe at the playhead, or remove the one already there. */
  toggleKeyframe: (ch: Channel) => void;
}

/** Binds one clip's channels to the store at the current playhead. */
export function useChannelApi(clip: Clip, t: number): ChannelApi {
  const actions = useActions();
  const time = usePlayhead();
  const fps = useEditor((s) => s.doc.project.fps);

  const rel = Math.max(0, Math.min(clip.duration, t - clip.start));
  const half = 0.5 / fps;
  const values = evaluateClip(clip, t);
  const at = (ch: Channel) => clip.props.keyframes[ch]?.find((k) => Math.abs(k.time - rel) < half);

  return {
    values,
    animated: (ch) => isAnimated(clip.props.keyframes, ch),
    keyframeHere: at,
    set: (ch, value, preview) => actions.setChannelValue(clip.id, ch, rel, value, preview ? { preview: true } : undefined),
    commit: () => actions.commit(),
    toggle: (ch) => actions.toggleChannelAnimated(clip.id, ch, rel, values[ch]),
    jump: (ch, dir) => {
      const kfs = sortKfs(clip.props.keyframes[ch] ?? []);
      const next = dir > 0 ? kfs.find((k) => k.time > rel + 1e-3) : [...kfs].reverse().find((k) => k.time < rel - 1e-3);
      if (next) time.set(clip.start + next.time);
    },
    toggleKeyframe: (ch) => {
      const here = at(ch);
      if (here) actions.removeKeyframe(clip.id, ch, here.id);
      else actions.addKeyframe(clip.id, ch, rel, values[ch]);
    },
  };
}

// ── Row pieces ─────────────────────────────────────────────

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-[18px] place-items-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
    >
      {children}
    </button>
  );
}

/**
 * Stopwatch + label + keyframe navigation. The nav only reacts once animated.
 * `label` shortens the visible text; accessible names keep the channel's name.
 */
export function ChannelHead({ api, ch, label, trailing }: { api: ChannelApi; ch: Channel; label?: string; trailing?: React.ReactNode }) {
  const name = CHANNELS[ch].label;
  const shown = label ?? name;
  const on = api.animated(ch);
  const here = api.keyframeHere(ch);
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Stopwatch on={on} label={name} onToggle={() => api.toggle(ch)} />
      <span className={cn("min-w-0 flex-1 truncate text-[12px]", on ? "text-foreground" : "text-muted-foreground")}>{shown}</span>
      <div className={cn("flex shrink-0 items-center transition-opacity", on ? "opacity-100" : "pointer-events-none opacity-0")}>
        <NavButton label={`Previous ${name} keyframe`} onClick={() => api.jump(ch, -1)}>
          <ChevronLeft size={12} />
        </NavButton>
        <NavButton label={here ? `Remove ${name} keyframe` : `Add ${name} keyframe`} onClick={() => api.toggleKeyframe(ch)}>
          <Diamond size={8} color={CHANNELS[ch].color} hollow={!here} />
        </NavButton>
        <NavButton label={`Next ${name} keyframe`} onClick={() => api.jump(ch, 1)}>
          <ChevronRight size={12} />
        </NavButton>
      </div>
      {trailing}
    </div>
  );
}

/** Head row plus a slider; the readout beside the head stays scrubbable. */
export function ChannelSlider({
  api,
  ch,
  min,
  max,
  step = 1,
  precision = 0,
  suffix,
  label,
}: {
  api: ChannelApi;
  ch: Channel;
  min: number;
  max: number;
  step?: number;
  precision?: number;
  suffix?: string;
  label?: string;
}) {
  const name = CHANNELS[ch].label;
  const value = api.values[ch];
  return (
    <div className="flex flex-col gap-1.5">
      <ChannelHead
        api={api}
        ch={ch}
        label={label}
        trailing={
          <NumberField
            label={name}
            value={value}
            min={min}
            max={max}
            step={step}
            precision={precision}
            suffix={suffix}
            align="right"
            size="compact"
            variant="bare"
            className="w-[76px] shrink-0"
            onChange={(v) => api.set(ch, v, true)}
            onCommit={api.commit}
          />
        }
      />
      <ScrubRegion>
        <Slider
          aria-label={name}
          value={value}
          min={min}
          max={max}
          step={step}
          showValue={false}
          onChange={(v) => typeof v === "number" && api.set(ch, v, true)}
        />
      </ScrubRegion>
    </div>
  );
}

/** Head row plus a boxed scrubbable number, for unbounded channels (X / Y). */
export function ChannelNumber({ api, ch, min, max, step = 1, suffix }: { api: ChannelApi; ch: Channel; min: number; max: number; step?: number; suffix?: string }) {
  const name = CHANNELS[ch].label;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <ChannelHead api={api} ch={ch} label={ch.toUpperCase()} />
      <NumberField
        label={name}
        value={api.values[ch]}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        onChange={(v) => api.set(ch, v, true)}
        onCommit={api.commit}
      />
    </div>
  );
}
