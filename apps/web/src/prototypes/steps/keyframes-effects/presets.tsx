/**
 * Presets — motion first. A gallery of presets with thumbnails that play on
 * hover; applying one writes real keyframes into the clip which you can then
 * tweak in a plain list (time · value · easing). Beginner-first.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select";
import { Slider } from "#/components/ui/slider";
import { cn } from "#/lib/utils";
import {
  ALL_CHANNELS,
  CHANNELS,
  EASING_PRESETS,
  HERO_CLIP,
  evaluateAll,
  fmtClipTime,
  formatValue,
  nextId,
  snapFrame,
  sortKfs,
  useKeyframeStore,
  useTransport,
  type Easing,
  type EasingPreset,
  type KeyframeMap,
} from "./engine";
import { Diamond, EditorFrame, NumberField, PreviewCanvas, SectionTitle, Timeline, TransportBar } from "./shared";

interface Preset {
  id: string;
  name: string;
  hint: string;
  /** Build keyframes for an intro of `d` seconds on a clip of `total` seconds. */
  build: (d: number, total: number) => KeyframeMap;
}

const kf = (t: number, value: number, easing: Easing = "ease-out") => ({ id: nextId("p"), t, value, easing });

const PRESETS: Preset[] = [
  { id: "fade", name: "Fade in", hint: "Opacity 0 → 100", build: (d) => ({ opacity: [kf(0, 0), kf(d, 100)] }) },
  { id: "slide", name: "Slide up", hint: "Y +240 → 0, fades", build: (d) => ({ y: [kf(0, 240), kf(d, 0)], opacity: [kf(0, 0), kf(d * 0.7, 100)] }) },
  { id: "pop", name: "Pop", hint: "Scale 60 → 100, spring", build: (d) => ({ scale: [kf(0, 60, "spring"), kf(d, 100)], opacity: [kf(0, 0, "ease-out"), kf(d * 0.4, 100)] }) },
  { id: "blur", name: "Blur in", hint: "Blur 24 → 0", build: (d) => ({ blur: [kf(0, 24), kf(d, 0)], opacity: [kf(0, 0), kf(d * 0.6, 100)] }) },
  {
    id: "kenburns",
    name: "Ken Burns",
    hint: "Slow push-in across the clip",
    build: (_d, total) => ({ scale: [kf(0, 100, "linear"), kf(total, 118)], x: [kf(0, 0, "linear"), kf(total, -60)], y: [kf(0, 0, "linear"), kf(total, 30)] }),
  },
];

export function Presets() {
  const transport = useTransport();
  const store = useKeyframeStore(() => PRESETS[1].build(0.8, HERO_CLIP.duration));
  const [applied, setApplied] = useState<string>("slide");
  const [dur, setDur] = useState(0.8);
  const [selectedClip, setSelectedClip] = useState<string | null>(HERO_CLIP.id);
  const t = transport.clipTime;
  const values = store.evaluate(t);

  const apply = (p: Preset, d = dur) => {
    store.setMap(p.build(d, HERO_CLIP.duration));
    setApplied(p.id);
    transport.seekClip(0);
    transport.play();
  };

  return (
    <EditorFrame
      inspectorWidth={330}
      preview={
        <>
          <PreviewCanvas values={values} transport={transport} />
          <TransportBar transport={transport}>
            <span className="text-muted-foreground">
              {applied ? `${PRESETS.find((p) => p.id === applied)?.name} · ${store.all.length} keyframes` : `${store.all.length} keyframes`}
            </span>
          </TransportBar>
        </>
      }
      inspector={
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: HERO_CLIP.tint }} />
            <span className="truncate font-medium">{HERO_CLIP.label}</span>
          </div>
          <SectionTitle>Motion</SectionTitle>
          <div className="grid grid-cols-2 gap-2 px-3">
            {PRESETS.map((p) => (
              <PresetCard key={p.id} preset={p} active={applied === p.id} onApply={() => apply(p)} />
            ))}
            <button
              type="button"
              onClick={() => {
                store.setMap({});
                setApplied("");
              }}
              className="flex h-[84px] flex-col items-center justify-center rounded-lg border border-dashed border-border text-[11px] text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
            >
              None
              <span className="text-[10px]">Remove motion</span>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3 px-3">
            <span className="w-14 text-[11px] text-muted-foreground">Duration</span>
            <Slider
              size="compact"
              showValue={false}
              className="flex-1"
              value={dur}
              min={0.2}
              max={3}
              step={0.1}
              aria-label="Preset duration"
              onChange={(v) => {
                if (typeof v !== "number") return;
                setDur(v);
                const p = PRESETS.find((x) => x.id === applied);
                if (p && p.id !== "kenburns") store.setMap(p.build(v, HERO_CLIP.duration));
              }}
            />
            <span className="w-9 text-right tabular-nums">{dur.toFixed(1)}s</span>
          </div>

          <SectionTitle>Keyframes</SectionTitle>
          {store.all.length === 0 && <div className="px-3 text-[11px] text-muted-foreground">Pick a preset above, or add a keyframe to any property below.</div>}
          {ALL_CHANNELS.map((ch) => {
            const kfs = sortKfs(store.map[ch] ?? []);
            if (!kfs.length && CHANNELS[ch].group === "effect" && ch !== "blur") return null;
            return (
              <div key={ch} className="mb-2 px-3">
                <div className="flex h-6 items-center gap-2 text-[11px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHANNELS[ch].color, opacity: kfs.length ? 1 : 0.35 }} />
                  <span className={kfs.length ? "text-foreground" : "text-muted-foreground"}>{CHANNELS[ch].label}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{formatValue(ch, values[ch])}</span>
                  <button
                    type="button"
                    aria-label={`Add ${CHANNELS[ch].label} keyframe at playhead`}
                    onClick={() => {
                      store.addAt(ch, snapFrame(t), values[ch]);
                      setApplied("");
                    }}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-hover hover:text-foreground"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {kfs.map((k) => (
                  <div key={k.id} className="grid grid-cols-[auto_56px_1fr_100px_auto] items-center gap-1.5 py-0.5 pl-1 text-[11px]">
                    <Diamond size={7} color={CHANNELS[ch].color} />
                    <button
                      type="button"
                      className="rounded-sm text-left tabular-nums text-muted-foreground hover:text-foreground"
                      onClick={() => transport.seekClip(k.t)}
                      title="Jump to keyframe"
                    >
                      {fmtClipTime(k.t)}
                    </button>
                    <NumberField channel={ch} value={k.value} onChange={(v) => store.setValue(ch, k.id, v)} width={72} />
                    <Select size="compact" value={Array.isArray(k.easing) ? "ease-in-out" : k.easing} onValueChange={(v) => store.setEasing(ch, k.id, v as EasingPreset)}>
                      <SelectTrigger className="h-6 text-[10px]" />
                      <SelectContent>
                        {EASING_PRESETS.map((p, i) => (
                          <SelectItem key={p.value} value={p.value} index={i}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button type="button" aria-label="Delete keyframe" onClick={() => store.remove(ch, k.id)} className="rounded-sm p-0.5 text-muted-foreground hover:text-destructive">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      }
      timeline={
        <Timeline
          transport={transport}
          selectedId={selectedClip}
          onSelect={setSelectedClip}
          trackHeight={30}
          renderInClip={(c, pps) =>
            c.id === HERO_CLIP.id ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0.5 h-2">
                {store.all.map(({ ch, kf: k }) => (
                  <Diamond key={k.id} size={5} color={CHANNELS[ch].color} className="absolute top-0" style={{ left: k.t * pps - 2.5 }} />
                ))}
              </div>
            ) : null
          }
        />
      }
    />
  );
}

function PresetCard({ preset, active, onApply }: { preset: Preset; active: boolean; onApply: () => void }) {
  const [hover, setHover] = useState(false);
  const [pt, setPt] = useState(1);
  const mapRef = useRef<KeyframeMap>(preset.build(0.8, 2));
  useEffect(() => {
    if (!hover) {
      setPt(1);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setPt(((now - start) / 1000) % 1.6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hover]);
  const v = evaluateAll(mapRef.current, Math.min(pt, 2));
  const isKB = preset.id === "kenburns";
  return (
    <button
      type="button"
      onClick={onApply}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className={cn(
        "relative flex h-[84px] flex-col overflow-hidden rounded-lg border text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground/50",
        active ? "border-foreground/70 bg-surface-4" : "border-border bg-surface-3 hover:bg-hover",
      )}
    >
      <div className="relative h-[42px] w-full overflow-hidden bg-black/40">
        <div
          className="absolute left-1/2 top-1/2 h-4 w-7 rounded-[2px]"
          style={{
            background: HERO_CLIP.tint,
            opacity: v.opacity / 100,
            transform: `translate(-50%, -50%) translate(${(v.x / 1920) * 100}%, ${(v.y / 1080) * 40}px) scale(${isKB ? 0.8 + ((v.scale - 100) / 18) * 0.2 : v.scale / 100})`,
            filter: `blur(${v.blur / 8}px)`,
          }}
        />
      </div>
      <div className="flex items-center gap-1 px-2 py-1">
        <span className="text-[11px] font-medium">{preset.name}</span>
        {active && <Check size={11} className="ml-auto" />}
      </div>
      <span className="px-2 pb-1 text-[10px] leading-none text-muted-foreground">{preset.hint}</span>
    </button>
  );
}
