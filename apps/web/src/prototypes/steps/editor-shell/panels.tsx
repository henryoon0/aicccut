"use client";

/** Panel bodies shared inside the editor-shell step. */

import { useState, type ReactNode } from "react";
import { Film, ImageIcon, Music, Search, type LucideIcon } from "lucide-react";
import { Slider } from "#/components/ui/slider.tsx";
import { cn } from "#/lib/utils.ts";
import {
  ASSETS,
  PROJECT_DURATION,
  fileSize,
  shortDuration,
  timecode,
  type Asset,
} from "#/prototypes/mock";
import { PROJECT, clipAt, type Transport } from "./shared";

/* ─────────────────────── Media grid ─────────────────────── */

const KIND_ICON: Record<Asset["kind"], LucideIcon> = {
  video: Film,
  audio: Music,
  image: ImageIcon,
};

export function MediaGrid({
  columns = 2,
  filter,
  showSearch = true,
  className,
}: {
  columns?: 1 | 2 | 3 | 4;
  filter?: Asset["kind"];
  showSearch?: boolean;
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>("a3");
  const [query, setQuery] = useState("");
  const items = ASSETS.filter(
    (a) => (!filter || a.kind === filter) && a.name.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {showSearch && (
        <label className="m-2 flex h-7 items-center gap-1.5 rounded-md bg-surface-3 px-2 text-[12px] shadow-surface-1 focus-within:ring-1 focus-within:ring-ring">
          <Search size={13} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search media"
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      )}
      <div
        className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto p-2 pt-0"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((a) => {
          const Icon = KIND_ICON[a.kind];
          const active = selected === a.id;
          return (
            <button
              type="button"
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={cn(
                "group flex flex-col gap-1 rounded-md p-1 text-left outline-none transition-colors duration-80 hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring",
                active && "bg-selected/40"
              )}
            >
              <div
                className="relative aspect-video w-full overflow-hidden rounded-[5px]"
                style={{
                  background: `linear-gradient(135deg, ${a.tint} 0%, color-mix(in oklab, ${a.tint} 55%, black) 100%)`,
                }}
              >
                <Icon size={14} className="absolute top-1.5 left-1.5 text-white/80" />
                {a.duration > 0 && (
                  <span className="absolute right-1 bottom-1 rounded-sm bg-black/50 px-1 text-[10px] tabular-nums text-white">
                    {shortDuration(a.duration)}
                  </span>
                )}
              </div>
              <span className="truncate text-[11px] text-foreground">{a.name}</span>
              <span className="truncate text-[10px] text-muted-foreground">
                {a.width ? `${a.width}×${a.height}` : fileSize(a.size)}
              </span>
            </button>
          );
        })}
        {items.length === 0 && (
          <p className="col-span-full py-8 text-center text-[12px] text-muted-foreground">
            No media matches "{query}"
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Preview canvas ─────────────────────── */

/** 16:9 frame fitted inside whatever box it gets. Shows the clip under the playhead.
 *  Custom vertical padding: pass e.g. `p-6 [--pv-pad:3rem]` (total top+bottom). */
export function PreviewCanvas({
  t,
  className,
  children,
  frameClassName,
}: {
  t: Transport;
  className?: string;
  /** Overlays drawn on top of the frame (transport, chips…). */
  children?: ReactNode;
  frameClassName?: string;
}) {
  const v1 = clipAt("t-v1", t.time);
  const v2 = clipAt("t-v2", t.time);
  const text = clipAt("t-text", t.time);
  const fx = clipAt("t-fx", t.time);
  const base = v1?.tint ?? "#1b1b1f";
  return (
    <div className={cn("relative flex min-h-0 min-w-0 flex-1 items-center justify-center p-4 [container-type:size]", className)}>
      <div
        className={cn(
          "relative aspect-video max-h-full max-w-full overflow-hidden rounded-md shadow-surface-3",
          frameClassName
        )}
        style={{
          width: "min(100%, calc((100cqh - var(--pv-pad, 2rem)) * 16 / 9))",
          background: `radial-gradient(120% 90% at 30% 20%, color-mix(in oklab, ${base} 80%, white) 0%, ${base} 45%, color-mix(in oklab, ${base} 35%, black) 100%)`,
          filter: fx ? "blur(1.5px)" : undefined,
          transition: "filter 120ms ease-out",
        }}
      >
        {v2 && (
          <div
            className="absolute top-[8%] right-[6%] aspect-video w-[34%] rounded-sm shadow-surface-4"
            style={{
              background: `linear-gradient(160deg, color-mix(in oklab, ${v2.tint} 80%, white), ${v2.tint})`,
            }}
          />
        )}
        {text && (
          <div className="absolute inset-x-[8%] bottom-[14%] text-center">
            <span className="inline-block rounded-md bg-black/45 px-[3%] py-[1.2%] text-[clamp(11px,2.6cqw,28px)] font-semibold tracking-tight text-white backdrop-blur-sm">
              {text.label}
            </span>
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-sm bg-black/40 px-1.5 py-0.5 text-[10px] tabular-nums text-white/90">
          {timecode(t.time, PROJECT.fps)}
        </span>
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────── Scrubber ─────────────────────── */

export function Scrubber({ t, className }: { t: Transport; className?: string }) {
  return (
    <Slider
      className={className}
      variant="scrubber"
      size="compact"
      showValue={false}
      value={t.time}
      onChange={(v) => t.seek(Array.isArray(v) ? v[0] : v)}
      min={0}
      max={PROJECT_DURATION}
      step={1 / PROJECT.fps}
      aria-label="Scrub"
    />
  );
}

/* ─────────────────────── Inspector ─────────────────────── */

interface Field {
  key: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
}

const FIELDS: Field[] = [
  { key: "x", label: "Position X", unit: "px", min: -1920, max: 1920, step: 1 },
  { key: "y", label: "Position Y", unit: "px", min: -1080, max: 1080, step: 1 },
  { key: "scale", label: "Scale", unit: "%", min: 1, max: 400, step: 1 },
  { key: "rotation", label: "Rotation", unit: "°", min: -180, max: 180, step: 1 },
];

/** Position / Scale / Rotation number fields plus an Opacity slider. Real state. */
export function InspectorFields({
  compact = false,
  className,
  layout = "rows",
}: {
  compact?: boolean;
  className?: string;
  /** rows = label left, value right. grid = 2-col label-over-value tiles. */
  layout?: "rows" | "grid";
}) {
  const [values, setValues] = useState<Record<string, number>>({ x: 0, y: 0, scale: 100, rotation: 0 });
  const [opacity, setOpacity] = useState(100);
  const set = (k: string, v: number) => setValues((s) => ({ ...s, [k]: v }));
  const inputClass = cn(
    "w-full rounded-md bg-surface-3 text-right tabular-nums text-foreground shadow-surface-1 outline-none transition-shadow focus:ring-1 focus:ring-ring",
    compact ? "h-6 px-1.5 text-[11px]" : "h-7 px-2 text-[12px]"
  );
  return (
    <div className={cn("flex flex-col gap-3 p-3 text-[12px]", compact && "gap-2 p-2", className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">screen_hooks_demo</span>
        <span className="text-[10px] text-muted-foreground">Video 1</span>
      </div>
      <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Transform</div>
      <div className={cn(layout === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-1.5")}>
        {FIELDS.map((f) => (
          <label
            key={f.key}
            className={cn(layout === "grid" ? "flex flex-col gap-1" : "grid grid-cols-[1fr_88px] items-center gap-2")}
          >
            <span className="truncate text-muted-foreground">{f.label}</span>
            <span className="relative">
              <input
                type="number"
                value={values[f.key]}
                min={f.min}
                max={f.max}
                step={f.step}
                onChange={(e) => set(f.key, Number(e.target.value))}
                className={cn(inputClass, f.unit && "pr-6")}
              />
              {f.unit && (
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-muted-foreground">
                  {f.unit}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Appearance</div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Opacity</span>
          <span className="tabular-nums text-foreground">{opacity}%</span>
        </div>
        <Slider
          size="compact"
          showValue={false}
          value={opacity}
          onChange={(v) => setOpacity(Math.round(Array.isArray(v) ? v[0] : v))}
          min={0}
          max={100}
          step={1}
          aria-label="Opacity"
        />
      </div>
      <div className="grid grid-cols-[1fr_88px] items-center gap-2">
        <span className="text-muted-foreground">Blend mode</span>
        <span className={cn(inputClass, "flex items-center justify-between text-left")}>Normal</span>
      </div>
    </div>
  );
}
