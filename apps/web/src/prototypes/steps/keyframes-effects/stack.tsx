/**
 * Stack — effects are a vertical stack of cards on the clip. Each card has an
 * enable switch, a drag handle to reorder, and one "animate" toggle per
 * parameter that unfolds a mini keyframe track inside the card. No lanes in
 * the timeline: the clip just shows how many effects it carries.
 */
import { useState, type ReactNode } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import { Diamond as DiamondIcon, GripVertical, Plus, Trash2 } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { DropdownContent, DropdownMenu, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { Slider } from "#/components/ui/slider";
import { Switch } from "#/components/ui/switch";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { EFFECTS } from "#/prototypes/mock";
import {
  CHANNELS,
  HERO_CLIP,
  TRANSFORM_CHANNELS,
  fmtClipTime,
  formatValue,
  snapFrame,
  useKeyframeStore,
  useTransport,
  type Channel,
  type ChannelValues,
  type KeyframeStore,
} from "./engine";
import { EditorFrame, KeyframeTrack, NumberField, PreviewCanvas, SectionTitle, Timeline, TransportBar } from "./shared";

interface FxCard {
  id: string;
  channel: Channel;
  enabled: boolean;
}

const EFFECT_CHANNELS: Channel[] = ["blur", "brightness", "contrast", "saturation"];

export function Stack() {
  const transport = useTransport();
  const store = useKeyframeStore();
  const [cards, setCards] = useState<FxCard[]>([
    { id: "fx1", channel: "blur", enabled: true },
    { id: "fx2", channel: "brightness", enabled: true },
  ]);
  const [selectedClip, setSelectedClip] = useState<string | null>(HERO_CLIP.id);
  const [selKf, setSelKf] = useState<string | null>(null);
  const t = transport.clipTime;
  const raw = store.evaluate(t);
  const values: ChannelValues = { ...raw };
  for (const ch of EFFECT_CHANNELS) {
    const card = cards.find((c) => c.channel === ch);
    if (!card || !card.enabled) values[ch] = CHANNELS[ch].base;
  }
  const filterOrder = cards.filter((c) => c.enabled).map((c) => c.channel);

  const paramRow = (ch: Channel, opts?: { slider?: boolean }) => {
    const on = store.isAnimated(ch);
    const here = store.map[ch]?.some((k) => Math.abs(k.t - t) < 1 / 60);
    return (
      <div key={ch} className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="w-[76px] truncate text-[11px] text-muted-foreground">{CHANNELS[ch].label}</span>
          {opts?.slider ? (
            <Slider
              size="compact"
              showValue={false}
              className="min-w-0 flex-1"
              value={values[ch]}
              min={CHANNELS[ch].min}
              max={CHANNELS[ch].max}
              step={CHANNELS[ch].step}
              onChange={(v) => typeof v === "number" && store.setAt(ch, snapFrame(t), v)}
              aria-label={CHANNELS[ch].label}
            />
          ) : (
            <span className="flex-1" />
          )}
          <NumberField channel={ch} value={values[ch]} animated={on} atKeyframe={here} onChange={(v) => store.setAt(ch, snapFrame(t), v)} width={64} />
          <button
            type="button"
            aria-pressed={on}
            aria-label={`Animate ${CHANNELS[ch].label}`}
            onClick={() => store.toggleAnimated(ch, snapFrame(t), values[ch])}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md border transition-colors hover:bg-hover",
              on ? "border-sky-400/50 text-sky-300" : "border-border text-muted-foreground/70",
            )}
          >
            <DiamondIcon size={11} fill={on ? "currentColor" : "none"} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {on && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.moderate}
              className="overflow-hidden"
            >
              <div className="mt-1.5 flex items-center gap-2 pl-[84px]">
                <KeyframeTrack
                  keyframes={store.map[ch] ?? []}
                  duration={HERO_CLIP.duration}
                  playhead={t}
                  color={CHANNELS[ch].color}
                  selectedId={selKf}
                  onSelect={setSelKf}
                  onMove={(id, tt) => store.move(ch, id, tt)}
                  onAdd={(tt) => setSelKf(store.addAt(ch, tt, values[ch]))}
                  onDelete={(id) => store.remove(ch, id)}
                  onScrub={(tt) => transport.seekClip(tt)}
                  height={18}
                />
                <button
                  type="button"
                  aria-label="Add keyframe at playhead"
                  onClick={() => setSelKf(store.addAt(ch, snapFrame(t), values[ch]))}
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-hover hover:text-foreground"
                >
                  <Plus size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <EditorFrame
      inspectorWidth={340}
      preview={
        <>
          <PreviewCanvas values={values} transport={transport} filterOrder={filterOrder} />
          <TransportBar transport={transport}>
            <span className="text-muted-foreground">Render order: {filterOrder.map((c) => CHANNELS[c].label).join(" → ") || "none"}</span>
          </TransportBar>
        </>
      }
      inspector={
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: HERO_CLIP.tint }} />
            <span className="truncate font-medium">{HERO_CLIP.label}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">{fmtClipTime(t)}</span>
          </div>

          <div className="mx-3 mt-3 rounded-lg border border-border bg-surface-3">
            <div className="flex h-9 items-center gap-2 border-b border-border/60 px-3 text-[11px] font-medium">
              Transform
              <span className="ml-auto text-muted-foreground">pinned</span>
            </div>
            <div className="py-1">{TRANSFORM_CHANNELS.map((ch) => paramRow(ch))}</div>
          </div>

          <SectionTitle
            right={
              <DropdownMenu size="compact">
                <DropdownTrigger render={<Button variant="secondary" size="compact" leadingIcon={Plus}>Add</Button>} />
                <DropdownContent align="end" className="min-w-48">
                  {EFFECTS.map((fx, i) => {
                    const ch = EFFECT_CHANNELS.find((c) => c === fx.id);
                    const used = !!ch && cards.some((c) => c.channel === ch);
                    return (
                      <MenuItem
                        key={fx.id}
                        index={i}
                        label={fx.name}
                        disabled={!ch || used}
                        onSelect={() => ch && setCards((c) => [...c, { id: `fx${Date.now()}`, channel: ch, enabled: true }])}
                      />
                    );
                  })}
                </DropdownContent>
              </DropdownMenu>
            }
          >
            Effects · {cards.length}
          </SectionTitle>

          <Reorder.Group axis="y" values={cards} onReorder={setCards} className="mx-3 flex flex-col gap-2">
            {cards.map((card) => (
              <EffectCard
                key={card.id}
                card={card}
                store={store}
                onToggle={() => setCards((c) => c.map((x) => (x.id === card.id ? { ...x, enabled: !x.enabled } : x)))}
                onRemove={() => {
                  setCards((c) => c.filter((x) => x.id !== card.id));
                  store.clearChannel(card.channel);
                }}
              >
                {paramRow(card.channel, { slider: true })}
              </EffectCard>
            ))}
          </Reorder.Group>
          {cards.length === 0 && <div className="px-3 text-[11px] text-muted-foreground">Add an effect. Cards render top to bottom.</div>}
        </div>
      }
      timeline={
        <Timeline
          transport={transport}
          selectedId={selectedClip}
          onSelect={setSelectedClip}
          trackHeight={30}
          renderInClip={(c) =>
            c.id === HERO_CLIP.id && cards.length > 0 ? (
              <div className="pointer-events-none absolute right-1 top-1">
                <Badge size="compact" color="violet">
                  {cards.filter((x) => x.enabled).length} fx
                </Badge>
              </div>
            ) : null
          }
        />
      }
    />
  );
}

function EffectCard({
  card,
  store,
  onToggle,
  onRemove,
  children,
}: {
  card: FxCard;
  store: KeyframeStore;
  onToggle: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const controls = useDragControls();
  const meta = CHANNELS[card.channel];
  const fx = EFFECTS.find((f) => f.id === card.channel);
  const animated = store.isAnimated(card.channel);
  return (
    <Reorder.Item
      value={card}
      dragListener={false}
      dragControls={controls}
      layout
      transition={spring.moderate}
      className={cn("rounded-lg border border-border bg-surface-3 shadow-surface-3", !card.enabled && "opacity-60")}
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}
    >
      <div className="flex h-9 items-center gap-2 border-b border-border/60 pl-1.5 pr-2">
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
        <span className="text-[11px] font-medium">{fx?.name ?? meta.label}</span>
        <span className="text-[11px] text-muted-foreground">{fx?.description}</span>
        {animated && <span className="text-[10px] text-sky-300">animated</span>}
        <div className="ml-auto flex items-center gap-1">
          <Switch size="compact" label="" aria-label={`Enable ${meta.label}`} checked={card.enabled} onToggle={onToggle} />
          <button type="button" aria-label={`Remove ${meta.label}`} onClick={onRemove} className="rounded-sm p-1 text-muted-foreground hover:text-destructive">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="py-1">{children}</div>
      {!card.enabled && <div className="px-3 pb-2 text-[10px] text-muted-foreground">Bypassed · {formatValue(card.channel, CHANNELS[card.channel].base)}</div>}
    </Reorder.Item>
  );
}
