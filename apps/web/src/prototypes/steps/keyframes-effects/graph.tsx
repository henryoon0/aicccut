/**
 * Graph — the curve editor is the primary surface. Value-over-time lines per
 * channel, keyframes draggable in two axes, bezier handles on the selected
 * segment, easing presets as a Tabs row. The timeline only shows small ticks.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import {
  ALL_CHANNELS,
  CHANNELS,
  EASING_PRESETS,
  HERO_CLIP,
  easingLabel,
  easingToBezier,
  fmtClipTime,
  formatValue,
  interpolate,
  snapFrame,
  sortKfs,
  useKeyframeStore,
  useTransport,
  type Channel,
  type Easing,
  type EasingPreset,
} from "./engine";
import { EditorFrame, NumberField, PreviewCanvas, SectionTitle, Timeline, TransportBar } from "./shared";

const PAD = { l: 44, r: 12, t: 12, b: 20 };

export function Graph() {
  const transport = useTransport();
  const store = useKeyframeStore();
  const [visible, setVisible] = useState<Set<Channel>>(() => new Set<Channel>(["x", "opacity", "scale", "blur"]));
  const [sel, setSel] = useState<{ ch: Channel; id: string } | null>({ ch: "x", id: "" });
  const [selectedClip, setSelectedClip] = useState<string | null>(HERO_CLIP.id);
  const t = transport.clipTime;
  const values = store.evaluate(t);
  const D = HERO_CLIP.duration;

  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 220 });
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = size.w - PAD.l - PAD.r;
  const H = size.h - PAD.t - PAD.b;
  const norm = (ch: Channel, v: number) => (v - CHANNELS[ch].min) / (CHANNELS[ch].max - CHANNELS[ch].min);
  const denorm = (ch: Channel, n: number) => CHANNELS[ch].min + n * (CHANNELS[ch].max - CHANNELS[ch].min);
  const px = (tt: number) => PAD.l + (tt / D) * W;
  const py = (ch: Channel, v: number) => PAD.t + (1 - norm(ch, v)) * H;
  const fromPx = (x: number, y: number, ch: Channel) => ({
    t: snapFrame(Math.max(0, Math.min(D, ((x - PAD.l) / W) * D))),
    v: denorm(ch, Math.max(0, Math.min(1, 1 - (y - PAD.t) / H))),
  });

  const focusCh: Channel = sel?.ch ?? "x";
  const selected = sel ? store.map[sel.ch]?.find((k) => k.id === sel.id) : undefined;
  const next = useMemo(() => {
    if (!selected || !sel) return undefined;
    return sortKfs(store.map[sel.ch] ?? []).find((k) => k.t > selected.t);
  }, [selected, sel, store.map]);

  const paths = useMemo(() => {
    const out: { ch: Channel; d: string }[] = [];
    for (const ch of ALL_CHANNELS) {
      const kfs = store.map[ch];
      if (!kfs?.length || !visible.has(ch)) continue;
      const N = 160;
      let d = "";
      for (let i = 0; i <= N; i++) {
        const tt = (i / N) * D;
        const v = interpolate(kfs, tt, CHANNELS[ch].base);
        d += `${i ? "L" : "M"}${px(tt).toFixed(1)},${py(ch, v).toFixed(1)} `;
      }
      out.push({ ch, d });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.map, visible, W, H]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const dragKf = (e: ReactPointerEvent, ch: Channel, id: string) => {
    e.stopPropagation();
    setSel({ ch, id });
    const move = (ev: PointerEvent) => {
      const { x, y } = local(ev);
      const p = fromPx(x, y, ch);
      store.move(ch, id, p.t);
      if (!ev.shiftKey) store.setValue(ch, id, Math.round(p.v / CHANNELS[ch].step) * CHANNELS[ch].step);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const dragHandle = (e: ReactPointerEvent, which: 0 | 1) => {
    if (!sel || !selected || !next) return;
    e.stopPropagation();
    const ch = sel.ch;
    const P0 = { x: px(selected.t), y: py(ch, selected.value) };
    const P1 = { x: px(next.t), y: py(ch, next.value) };
    const dx = P1.x - P0.x || 1e-6;
    const dy = P1.y - P0.y;
    const move = (ev: PointerEvent) => {
      const { x, y } = local(ev);
      const b = [...easingToBezier(selected.easing)] as [number, number, number, number];
      if (which === 0) {
        b[0] = Math.max(0, Math.min(1, (x - P0.x) / dx));
        if (Math.abs(dy) > 1) b[1] = (y - P0.y) / dy;
      } else {
        b[2] = Math.max(0, Math.min(1, (x - P0.x) / dx));
        if (Math.abs(dy) > 1) b[3] = (y - P0.y) / dy;
      }
      store.setEasing(ch, sel.id, b as Easing);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handles = (() => {
    if (!selected || !next || !sel) return null;
    const ch = sel.ch;
    const [x1, y1, x2, y2] = easingToBezier(selected.easing);
    const P0 = { x: px(selected.t), y: py(ch, selected.value) };
    const P1 = { x: px(next.t), y: py(ch, next.value) };
    const dx = P1.x - P0.x, dy = P1.y - P0.y;
    const h1 = { x: P0.x + x1 * dx, y: P0.y + y1 * dy };
    const h2 = { x: P0.x + x2 * dx, y: P0.y + y2 * dy };
    return (
      <g>
        <line x1={P0.x} y1={P0.y} x2={h1.x} y2={h1.y} stroke="var(--foreground)" strokeOpacity={0.5} />
        <line x1={P1.x} y1={P1.y} x2={h2.x} y2={h2.y} stroke="var(--foreground)" strokeOpacity={0.5} />
        {[h1, h2].map((h, i) => (
          <circle key={i} cx={h.x} cy={h.y} r={5} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.5} className="cursor-move" onPointerDown={(e) => dragHandle(e, i as 0 | 1)} />
        ))}
      </g>
    );
  })();

  const gridVals = [0, 0.25, 0.5, 0.75, 1];
  const presetValue: string = selected ? (Array.isArray(selected.easing) ? "custom" : selected.easing) : "linear";

  return (
    <EditorFrame
      inspectorWidth={260}
      preview={
        <>
          <PreviewCanvas values={values} transport={transport} className="max-h-[46%]" />
          <TransportBar transport={transport}>
            <Tabs
              size="compact"
              value={presetValue}
              onValueChange={(v) => sel && selected && v !== "custom" && store.setEasing(sel.ch, sel.id, v as EasingPreset)}
            >
              <TabsList aria-label="Easing">
                {EASING_PRESETS.map((p) => (
                  <TabItem key={p.value} value={p.value} label={p.label} />
                ))}
                {presetValue === "custom" && <TabItem value="custom" label="Custom" />}
              </TabsList>
            </Tabs>
          </TransportBar>
          <div className="relative min-h-0 flex-1 border-t border-border bg-surface-1">
            <svg
              ref={svgRef}
              className="h-full w-full select-none"
              onPointerDown={(e) => {
                setSel((s) => (s ? { ch: s.ch, id: "" } : null));
                const { x } = local(e);
                transport.seekClip(fromPx(x, 0, focusCh).t);
              }}
              onDoubleClick={(e) => {
                const { x, y } = local(e);
                const p = fromPx(x, y, focusCh);
                setSel({ ch: focusCh, id: store.addAt(focusCh, p.t, p.v) });
              }}
            >
              {gridVals.map((g) => (
                <g key={g}>
                  <line x1={PAD.l} x2={PAD.l + W} y1={PAD.t + (1 - g) * H} y2={PAD.t + (1 - g) * H} stroke="var(--border)" strokeDasharray={g === 0 || g === 1 ? undefined : "2 4"} />
                  <text x={PAD.l - 6} y={PAD.t + (1 - g) * H + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)" className="tabular-nums">
                    {formatValue(focusCh, denorm(focusCh, g))}
                  </text>
                </g>
              ))}
              {Array.from({ length: Math.floor(D) + 1 }, (_, i) => (
                <text key={i} x={px(i)} y={size.h - 6} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
                  {i}s
                </text>
              ))}
              {paths.map((p) => (
                <path key={p.ch} d={p.d} fill="none" stroke={CHANNELS[p.ch].color} strokeWidth={p.ch === focusCh ? 2 : 1.25} strokeOpacity={p.ch === focusCh ? 1 : 0.45} />
              ))}
              {ALL_CHANNELS.filter((ch) => visible.has(ch)).map((ch) =>
                (store.map[ch] ?? []).map((k) => (
                  <g key={k.id} className="cursor-move" onPointerDown={(e) => dragKf(e, ch, k.id)}>
                    <circle cx={px(k.t)} cy={py(ch, k.value)} r={ch === focusCh ? 5 : 3.5} fill={sel?.id === k.id ? "var(--foreground)" : CHANNELS[ch].color} stroke="var(--background)" strokeWidth={1.5} />
                  </g>
                )),
              )}
              {handles}
              <line x1={px(t)} x2={px(t)} y1={PAD.t} y2={PAD.t + H} stroke="#f87171" className="pointer-events-none" />
              <circle cx={px(t)} cy={py(focusCh, values[focusCh])} r={3} fill="#f87171" className="pointer-events-none" />
            </svg>
            <div className="pointer-events-none absolute right-3 top-2 text-[10px] text-muted-foreground">
              Drag points · Shift keeps value · Double-click adds
            </div>
          </div>
        </>
      }
      inspector={
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
          <SectionTitle>Channels</SectionTitle>
          {ALL_CHANNELS.map((ch) => {
            const on = store.isAnimated(ch);
            const focus = ch === focusCh;
            return (
              <div
                key={ch}
                role="button"
                tabIndex={0}
                onClick={() => setSel({ ch, id: "" })}
                onKeyDown={(e) => e.key === "Enter" && setSel({ ch, id: "" })}
                className={cn("mx-2 flex h-7 items-center gap-2 rounded-md px-1.5 text-[11px] outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-foreground/50", focus && "bg-selected")}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: CHANNELS[ch].color, opacity: on ? 1 : 0.3 }} />
                <span className={cn("truncate", on ? "text-foreground" : "text-muted-foreground")}>{CHANNELS[ch].label}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{formatValue(ch, values[ch])}</span>
                <button
                  type="button"
                  aria-label={visible.has(ch) ? "Hide curve" : "Show curve"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setVisible((s) => {
                      const n = new Set(s);
                      if (n.has(ch)) n.delete(ch); else n.add(ch);
                      return n;
                    });
                  }}
                  className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                >
                  {visible.has(ch) ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
              </div>
            );
          })}
          <div className="mx-3 mt-2">
            <Button variant="tertiary" size="compact" leadingIcon={Plus} className="w-full" onClick={() => setSel({ ch: focusCh, id: store.addAt(focusCh, snapFrame(t), values[focusCh]) })}>
              Keyframe {CHANNELS[focusCh].label} at {fmtClipTime(t)}
            </Button>
          </div>
          <SectionTitle>Selected keyframe</SectionTitle>
          {selected && sel ? (
            <div className="mx-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
              <span className="text-muted-foreground">Time</span>
              <span className="tabular-nums">{fmtClipTime(selected.t)}</span>
              <span className="text-muted-foreground">Value</span>
              <NumberField channel={sel.ch} value={selected.value} onChange={(v) => store.setValue(sel.ch, sel.id, v)} width={88} />
              <span className="text-muted-foreground">Easing</span>
              <span>{easingLabel(selected.easing)}</span>
              <span className="text-muted-foreground">Bezier</span>
              <span className="tabular-nums text-muted-foreground">{easingToBezier(selected.easing).map((n) => n.toFixed(2)).join(", ")}</span>
              <div className="col-span-2 flex justify-end">
                <Button variant="ghost" size="compact" leadingIcon={Trash2} onClick={() => { store.remove(sel.ch, sel.id); setSel({ ch: sel.ch, id: "" }); }}>
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-3 text-[11px] text-muted-foreground">Click a point on the curve to edit its value and handles.</div>
          )}
        </div>
      }
      timeline={
        <Timeline
          transport={transport}
          selectedId={selectedClip}
          onSelect={setSelectedClip}
          trackHeight={22}
          renderInClip={(c, pps) =>
            c.id === HERO_CLIP.id ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5">
                {store.all.map(({ ch, kf }) => (
                  <span key={kf.id} className="absolute bottom-0 h-1.5 w-px" style={{ left: kf.t * pps, background: CHANNELS[ch].color }} />
                ))}
              </div>
            ) : null
          }
        />
      }
    />
  );
}
