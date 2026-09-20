/**
 * Property lanes that unfold under the selected clip: one row per animated
 * channel, each keyframe a diamond you can drag in time, click to seek to,
 * or delete with Backspace while it has focus. Double-click a lane to add a
 * keyframe holding the value the clip evaluates to right there.
 */
import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ALL_CHANNELS, CHANNELS, evaluateClip, formatChannelValue, useActions, useEditorContext } from "#/editor/core";
import type { Channel, Clip } from "#/editor/core";
import { cn } from "#/lib/utils";
import type { Viewport } from "./engine";
import { HEADER_W, LANE_H, clamp } from "./geometry";

export function KeyframeLanes({ clip, view }: { clip: Clip; view: Viewport }) {
  const [selected, setSelected] = useState<{ channel: Channel; id: string } | null>(null);
  return (
    // Tagged with the owning track so a clip dragged across the lanes still
    // hit-tests onto its own track instead of falling through to nothing.
    <div data-testid="keyframe-lanes" data-track-row={clip.trackId}>
      {ALL_CHANNELS.map((channel) => (
        <Lane key={channel} channel={channel} clip={clip} view={view} selected={selected} onSelect={setSelected} />
      ))}
    </div>
  );
}

function Lane({
  channel,
  clip,
  view,
  selected,
  onSelect,
}: {
  channel: Channel;
  clip: Clip;
  view: Viewport;
  selected: { channel: Channel; id: string } | null;
  onSelect: (v: { channel: Channel; id: string } | null) => void;
}) {
  const actions = useActions();
  const { time } = useEditorContext();
  const { pps, contentW, xToTime } = view;
  const meta = CHANNELS[channel];
  const keyframes = clip.props.keyframes[channel] ?? [];
  const laneRef = useRef<HTMLDivElement>(null);
  const width = Math.max(2, clip.duration * pps);

  const relAt = (clientX: number) => clamp(xToTime(clientX) - clip.start, 0, clip.duration);

  return (
    <div className="flex border-b border-border/40" style={{ height: LANE_H }}>
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r border-border bg-surface-3 pl-7 pr-2 text-[10px]"
        style={{ width: HEADER_W }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: meta.color, opacity: keyframes.length ? 1 : 0.35 }} />
        <span className={cn("truncate", keyframes.length ? "text-foreground" : "text-muted-foreground")}>{meta.label}</span>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {keyframes.length ? keyframes.length : formatChannelValue(channel, evaluateClip(clip, clip.start)[channel])}
        </span>
      </div>
      <div
        className="relative shrink-0 bg-surface-1/60"
        style={{ width: contentW }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect(null);
        }}
      >
        <div
          ref={laneRef}
          className="absolute inset-y-0 cursor-crosshair"
          style={{ left: clip.start * pps, width }}
          onDoubleClick={(e) => {
            const rel = relAt(e.clientX);
            const value = evaluateClip(clip, clip.start + rel)[channel];
            const id = actions.addKeyframe(clip.id, channel, rel, value);
            if (id) onSelect({ channel, id });
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-px bg-border/70" />
          {keyframes.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-label={`${meta.label} 키프레임 ${k.time.toFixed(2)}초`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-1 outline-none"
              style={{ left: k.time * pps }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                onSelect({ channel, id: k.id });
                e.currentTarget.focus();
                time.set(clip.start + k.time);
                let moved = false;
                const move = (ev: PointerEvent) => {
                  moved = true;
                  actions.moveKeyframe(clip.id, channel, k.id, relAt(ev.clientX), { preview: true });
                };
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  window.removeEventListener("pointercancel", up);
                  if (moved) actions.commit();
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
                window.addEventListener("pointercancel", up);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Backspace" && e.key !== "Delete") return;
                e.preventDefault();
                e.stopPropagation();
                actions.removeKeyframe(clip.id, channel, k.id);
                onSelect(null);
              }}
            >
              <Diamond color={meta.color} selected={selected?.channel === channel && selected.id === k.id} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Diamond({ color, selected, size = 9, style }: { color: string; selected?: boolean; size?: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className="block rounded-[1px] border transition-transform duration-100"
      style={{
        width: size,
        height: size,
        background: color,
        borderColor: selected ? "var(--foreground)" : color,
        boxShadow: selected ? "0 0 0 2px var(--background), 0 0 0 3px var(--foreground)" : undefined,
        transform: `rotate(45deg) scale(${selected ? 1.15 : 1})`,
        ...style,
      }}
    />
  );
}
