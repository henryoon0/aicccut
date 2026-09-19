/**
 * Inline — keyframes live next to their values. A stopwatch per property and,
 * once animated, a compact mini-timeline directly under that row. The main
 * timeline only shows a thin keyframe strip on the clip. Zero new panels.
 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  snapFrame,
  useKeyframeStore,
  useTransport,
  type Channel,
  type EasingPreset,
} from "./engine";
import { Diamond, EditorFrame, KeyframeTrack, NumberField, PreviewCanvas, SectionTitle, Stopwatch, Timeline, TransportBar } from "./shared";

const EFFECT_CHANNELS: Channel[] = ["blur", "brightness", "contrast", "saturation"];

export function Inline() {
  const transport = useTransport();
  const store = useKeyframeStore();
  const [selectedClip, setSelectedClip] = useState<string | null>(HERO_CLIP.id);
  const [selKf, setSelKf] = useState<{ ch: Channel; id: string } | null>(null);
  const [effects, setEffects] = useState<Channel[]>(["blur"]);
  const t = transport.clipTime;
  const values = store.evaluate(t);
  const selected = selKf ? store.map[selKf.ch]?.find((k) => k.id === selKf.id) : undefined;

  const row = (ch: Channel) => {
    const on = store.isAnimated(ch);
    const here = store.map[ch]?.some((k) => Math.abs(k.t - t) < 1 / 60);
    const isSelHere = selKf?.ch === ch && selected;
    return (
      <div key={ch} className={cn("group/row rounded-md px-2 py-1 transition-colors", on && "bg-surface-3/60")}>
        <div className="flex h-6 items-center gap-2">
          <Stopwatch on={on} label={CHANNELS[ch].label} onToggle={() => store.toggleAnimated(ch, snapFrame(t), values[ch])} />
          <span className={cn("flex-1 truncate text-[11px]", on ? "text-foreground" : "text-muted-foreground")}>{CHANNELS[ch].label}</span>
          {on && (
            <button
              type="button"
              aria-label="Add keyframe at playhead"
              onClick={() => setSelKf({ ch, id: store.addAt(ch, snapFrame(t), values[ch]) })}
              className="rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-hover hover:text-foreground group-hover/row:opacity-100 focus-visible:opacity-100"
            >
              <Plus size={12} />
            </button>
          )}
          <NumberField channel={ch} value={values[ch]} animated={on} atKeyframe={here} onChange={(v) => store.setAt(ch, snapFrame(t), v)} width={68} />
        </div>
        {on && (
          <div className="mt-0.5 flex items-center gap-2 pl-7">
            <KeyframeTrack
              keyframes={store.map[ch] ?? []}
              duration={HERO_CLIP.duration}
              playhead={t}
              color={CHANNELS[ch].color}
              selectedId={selKf?.ch === ch ? selKf.id : null}
              onSelect={(id) => setSelKf(id ? { ch, id } : null)}
              onMove={(id, tt) => store.move(ch, id, tt)}
              onAdd={(tt) => setSelKf({ ch, id: store.addAt(ch, tt, values[ch]) })}
              onDelete={(id) => store.remove(ch, id)}
              onScrub={(tt) => transport.seekClip(tt)}
              height={16}
              diamond={8}
            />
          </div>
        )}
        {isSelHere && selected && selKf && (
          <div className="mt-1 flex items-center gap-1.5 pl-7 text-[10px] text-muted-foreground">
            <span className="tabular-nums">{fmtClipTime(selected.t)}</span>
            <NumberField channel={ch} value={selected.value} onChange={(v) => store.setValue(ch, selKf.id, v)} width={60} className="h-5" />
            <Select size="compact" value={Array.isArray(selected.easing) ? "ease-in-out" : selected.easing} onValueChange={(v) => store.setEasing(ch, selKf.id, v as EasingPreset)}>
              <SelectTrigger className="h-5 w-[104px] text-[10px]" />
              <SelectContent>
                {EASING_PRESETS.map((p, i) => (
                  <SelectItem key={p.value} value={p.value} index={i}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              aria-label="Delete keyframe"
              onClick={() => {
                store.remove(ch, selKf.id);
                setSelKf(null);
              }}
              className="ml-auto rounded-sm p-0.5 hover:bg-hover hover:text-destructive"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <EditorFrame
      inspectorWidth={300}
      preview={
        <>
          <PreviewCanvas values={values} transport={transport} />
          <TransportBar transport={transport}>
            <span className="text-muted-foreground">{store.all.length} keyframes on this clip</span>
          </TransportBar>
        </>
      }
      inspector={
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-3">
          <div className="flex items-center gap-2 border-b border-border px-2 py-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: HERO_CLIP.tint }} />
            <span className="truncate font-medium">{HERO_CLIP.label}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">{fmtClipTime(t)}</span>
          </div>
          <SectionTitle>Transform</SectionTitle>
          <div className="flex flex-col gap-0.5">{TRANSFORM_CHANNELS.map(row)}</div>
          <SectionTitle
            right={
              <DropdownMenu size="compact">
                <DropdownTrigger render={<Button variant="ghost" size="compact" leadingIcon={Plus}>Add</Button>} />
                <DropdownContent align="end" className="min-w-44">
                  {EFFECTS.map((fx, i) => {
                    const ch = EFFECT_CHANNELS.find((c) => c === fx.id);
                    return <MenuItem key={fx.id} index={i} label={fx.name} disabled={!ch || effects.includes(ch)} onSelect={() => ch && setEffects((e) => [...e, ch])} />;
                  })}
                </DropdownContent>
              </DropdownMenu>
            }
          >
            Effects
          </SectionTitle>
          <div className="flex flex-col gap-0.5">
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
                  className="absolute right-[76px] top-1.5 rounded-sm p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover/fx:opacity-100"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {effects.length === 0 && <div className="px-2 text-[11px] text-muted-foreground">No effects.</div>}
          </div>
          <div className="mt-3 px-2 text-[10px] leading-relaxed text-muted-foreground">
            Stopwatch turns a value into a keyframe. Drag diamonds to retime, double-click the strip to add, Backspace to delete.
          </div>
        </div>
      }
      timeline={
        <Timeline
          transport={transport}
          selectedId={selectedClip}
          onSelect={setSelectedClip}
          trackHeight={32}
          renderInClip={(c, pps) =>
            c.id === HERO_CLIP.id ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[7px] bg-black/25">
                {store.all.map(({ ch, kf }) => (
                  <Diamond key={kf.id} size={5} color={CHANNELS[ch].color} className="absolute top-[1px]" style={{ left: kf.t * pps - 2.5 }} />
                ))}
              </div>
            ) : null
          }
        />
      }
    />
  );
}
