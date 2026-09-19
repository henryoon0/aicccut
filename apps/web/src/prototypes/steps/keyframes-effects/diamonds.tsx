/**
 * Diamonds — After Effects lineage. Selecting the clip unfolds one lane per
 * animated property directly under its track; every keyframe is a diamond you
 * drag in time. The inspector owns the stopwatches and the value scrubbers.
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { DropdownContent, DropdownMenu, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select";
import { cn } from "#/lib/utils";
import { EFFECTS } from "#/prototypes/mock";
import {
  CHANNELS,
  EASING_PRESETS,
  HERO_CLIP,
  TRANSFORM_CHANNELS,
  fmtClipTime,
  formatValue,
  snapFrame,
  sortKfs,
  useKeyframeStore,
  useTransport,
  type Channel,
  type EasingPreset,
} from "./engine";
import {
  Diamond,
  EditorFrame,
  NumberField,
  PreviewCanvas,
  SectionTitle,
  Stopwatch,
  Timeline,
  TransportBar,
  type LaneCtx,
} from "./shared";

const LANE_H = 22;
const EFFECT_CHANNELS: Channel[] = ["blur", "brightness", "contrast", "saturation"];

export function Diamonds() {
  const transport = useTransport();
  const store = useKeyframeStore();
  const [selectedClip, setSelectedClip] = useState<string | null>(HERO_CLIP.id);
  const [selKf, setSelKf] = useState<{ ch: Channel; id: string } | null>(null);
  const [effects, setEffects] = useState<Channel[]>(["blur"]);
  const t = transport.clipTime;
  const values = store.evaluate(t);
  const expanded = selectedClip === HERO_CLIP.id;
  const lanes = [...TRANSFORM_CHANNELS, ...effects].filter((ch) => store.isAnimated(ch));

  const kfAt = (ch: Channel) => store.map[ch]?.find((k) => Math.abs(k.t - t) < 1 / 60);
  const jump = (ch: Channel, dir: 1 | -1) => {
    const kfs = sortKfs(store.map[ch] ?? []);
    const next = dir > 0 ? kfs.find((k) => k.t > t + 1e-3) : [...kfs].reverse().find((k) => k.t < t - 1e-3);
    if (next) {
      transport.seekClip(next.t);
      setSelKf({ ch, id: next.id });
    }
  };
  const selected = selKf ? store.map[selKf.ch]?.find((k) => k.id === selKf.id) : undefined;

  const row = (ch: Channel) => {
    const on = store.isAnimated(ch);
    const here = kfAt(ch);
    return (
      <div key={ch} className="flex h-7 items-center gap-1.5 px-3">
        <Stopwatch on={on} label={CHANNELS[ch].label} onToggle={() => store.toggleAnimated(ch, snapFrame(t), values[ch])} />
        <span className={cn("w-[84px] truncate text-[11px]", on ? "text-foreground" : "text-muted-foreground")}>
          {CHANNELS[ch].label}
        </span>
        <div className={cn("flex items-center gap-0.5 transition-opacity", on ? "opacity-100" : "pointer-events-none opacity-0")}>
          <button type="button" aria-label="Previous keyframe" onClick={() => jump(ch, -1)} className="rounded-sm p-0.5 text-muted-foreground hover:bg-hover hover:text-foreground">
            <ChevronLeft size={12} />
          </button>
          <button
            type="button"
            aria-label={here ? "Remove keyframe" : "Add keyframe"}
            onClick={() => (here ? store.remove(ch, here.id) : setSelKf({ ch, id: store.addAt(ch, snapFrame(t), values[ch]) }))}
            className="flex h-5 w-5 items-center justify-center rounded-sm hover:bg-hover"
          >
            <Diamond size={8} color={CHANNELS[ch].color} hollow={!here} />
          </button>
          <button type="button" aria-label="Next keyframe" onClick={() => jump(ch, 1)} className="rounded-sm p-0.5 text-muted-foreground hover:bg-hover hover:text-foreground">
            <ChevronRight size={12} />
          </button>
        </div>
        <div className="ml-auto">
          <NumberField channel={ch} value={values[ch]} animated={on} atKeyframe={!!here} onChange={(v) => store.setAt(ch, snapFrame(t), v)} />
        </div>
      </div>
    );
  };

  const lane = (ch: Channel, ctx: LaneCtx) => {
    const meta = CHANNELS[ch];
    if (ctx.side === "header") {
      return (
        <div key={ch} className="flex items-center gap-1.5 border-b border-border/40 bg-surface-1/60 pl-5 pr-2 text-[10px] text-muted-foreground" style={{ height: LANE_H }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
          <span className="truncate">{meta.label}</span>
          <span className="ml-auto tabular-nums">{formatValue(ch, values[ch])}</span>
        </div>
      );
    }
    const left = ctx.toX(HERO_CLIP.start);
    const width = HERO_CLIP.duration * ctx.pxPerSec;
    return (
      <div
        key={ch}
        className="relative border-b border-border/40 bg-surface-1/60"
        style={{ height: LANE_H }}
        onPointerDown={() => setSelKf(null)}
      >
        <div
          data-kf
          className="absolute inset-y-0 cursor-crosshair"
          style={{ left, width }}
          onDoubleClick={(e) => {
            const rel = snapFrame(((e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left) / width) * HERO_CLIP.duration);
            setSelKf({ ch, id: store.addAt(ch, rel, values[ch]) });
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-px bg-border/70" />
          {(store.map[ch] ?? []).map((k) => (
            <button
              key={k.id}
              type="button"
              data-kf
              aria-label={`${meta.label} keyframe ${fmtClipTime(k.t)}`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-1 outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
              style={{ left: (k.t / HERO_CLIP.duration) * width }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setSelKf({ ch, id: k.id });
                (e.currentTarget as HTMLElement).focus();
                const laneEl = (e.currentTarget as HTMLElement).parentElement!;
                const r = laneEl.getBoundingClientRect();
                const move = (ev: PointerEvent) => store.move(ch, k.id, snapFrame(((ev.clientX - r.left) / r.width) * HERO_CLIP.duration));
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" || e.key === "Delete") store.remove(ch, k.id);
              }}
            >
              <Diamond size={9} color={meta.color} selected={selKf?.id === k.id} />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <EditorFrame
      preview={
        <>
          <PreviewCanvas values={values} transport={transport} />
          <TransportBar transport={transport}>
            <span className="text-muted-foreground">
              {lanes.length} animated · {store.all.length} keyframes
            </span>
          </TransportBar>
        </>
      }
      inspector={
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: HERO_CLIP.tint }} />
            <span className="truncate font-medium">{HERO_CLIP.label}</span>
            <span className="ml-auto text-muted-foreground tabular-nums">{fmtClipTime(t)}</span>
          </div>
          <SectionTitle>Transform</SectionTitle>
          {TRANSFORM_CHANNELS.map(row)}
          <SectionTitle
            right={
              <DropdownMenu size="compact">
                <DropdownTrigger render={<Button variant="ghost" size="compact" leadingIcon={Plus}>Add effect</Button>} />
                <DropdownContent align="end" className="min-w-44">
                  {EFFECTS.map((fx, i) => {
                    const ch = EFFECT_CHANNELS.find((c) => c === fx.id);
                    return (
                      <MenuItem
                        key={fx.id}
                        index={i}
                        label={fx.name}
                        disabled={!ch || effects.includes(ch)}
                        onSelect={() => ch && setEffects((e) => [...e, ch])}
                      />
                    );
                  })}
                </DropdownContent>
              </DropdownMenu>
            }
          >
            Effects
          </SectionTitle>
          {effects.length === 0 && <div className="px-3 py-2 text-[11px] text-muted-foreground">No effects on this clip.</div>}
          {effects.map((ch) => (
            <div key={ch} className="group/fx relative">
              {row(ch)}
              <button
                type="button"
                aria-label={`Remove ${CHANNELS[ch].label}`}
                onClick={() => {
                  setEffects((e) => e.filter((c) => c !== ch));
                  store.clearChannel(ch);
                }}
                className="absolute -left-0.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover/fx:opacity-100"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          <SectionTitle>Keyframe</SectionTitle>
          {selected && selKf ? (
            <div className="mx-3 rounded-lg border border-border bg-surface-3 p-2">
              <div className="flex items-center gap-2">
                <Diamond size={9} color={CHANNELS[selKf.ch].color} />
                <span className="font-medium">{CHANNELS[selKf.ch].label}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{fmtClipTime(selected.t)}</span>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-y-1.5">
                <span className="text-muted-foreground">Value</span>
                <NumberField channel={selKf.ch} value={selected.value} onChange={(v) => store.setValue(selKf.ch, selKf.id, v)} />
                <span className="text-muted-foreground">Easing</span>
                <Select
                  size="compact"
                  value={Array.isArray(selected.easing) ? "ease-in-out" : selected.easing}
                  onValueChange={(v) => store.setEasing(selKf.ch, selKf.id, v as EasingPreset)}
                >
                  <SelectTrigger className="w-[112px]" />
                  <SelectContent>
                    {EASING_PRESETS.map((p, i) => (
                      <SelectItem key={p.value} value={p.value} index={i}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="compact" leadingIcon={Trash2} onClick={() => { store.remove(selKf.ch, selKf.id); setSelKf(null); }}>
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-3 text-[11px] text-muted-foreground">Click a diamond in the timeline. Double-click a lane to add one.</div>
          )}
        </div>
      }
      timeline={
        <Timeline
          transport={transport}
          selectedId={selectedClip}
          onSelect={setSelectedClip}
          trackHeight={30}
          renderInClip={(c, pps) =>
            c.id === HERO_CLIP.id && !expanded ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0.5 h-2">
                {store.all.map(({ ch, kf }) => (
                  <Diamond key={kf.id} size={5} color={CHANNELS[ch].color} className="absolute top-0" style={{ left: kf.t * pps - 2.5 }} />
                ))}
              </div>
            ) : null
          }
          renderUnderTrack={(trackId, ctx) => {
            if (trackId !== HERO_CLIP.trackId || !expanded) return null;
            return <>{lanes.map((ch) => lane(ch, ctx))}</>;
          }}
        />
      }
    />
  );
}
