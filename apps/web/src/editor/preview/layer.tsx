/**
 * One composited clip. Media clips cover the whole frame; text clips hang off
 * its centre and size themselves. Both carry the same evaluated transform,
 * and the selection frame sits outside the filtered content so handles stay
 * crisp through a blur, whether it comes from the clip or an effect track.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import { evaluateClip, useActions, type AssetKind, type Clip, type Project } from "#/editor/core";
import { useAssetUrl } from "#/editor/media/files";
import { cn } from "#/lib/utils";
import { blendMode, clamp, clipFilter, layerTransform, textStyle, tintBackground, vignetteAmount } from "./helpers";

export interface ClipLayerProps {
  clip: Clip;
  /** Absolute playhead, seconds. */
  time: number;
  project: Project;
  /** Asset kind, when the clip points at one. */
  kind?: AssetKind;
  playing: boolean;
  muted: boolean;
  selected: boolean;
  /** Screen pixels per canvas pixel — keeps handles a constant size. */
  stageScale: number;
  /** False on a locked track: no selecting, no dragging. */
  interactive: boolean;
  /** Combined CSS filter of the effect tracks above this layer, if any. */
  stackFilter?: string;
}

export function ClipLayer({ clip, time, project, kind, playing, muted, selected, stageScale, interactive, stackFilter }: ClipLayerProps) {
  const actions = useActions();
  const url = useAssetUrl(clip.assetId);
  const elRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "scale"; px: number; py: number; x: number; y: number; scale: number; dist: number } | null>(null);

  const v = evaluateClip(clip, time);
  const isText = !!clip.props.text;
  // The clip's own filter runs first, then whatever the effect tracks add.
  const filter = [clipFilter(clip, v.blur), stackFilter].filter(Boolean).join(" ");
  const vignette = vignetteAmount(clip);

  const centre = () => {
    const r = elRef.current?.getBoundingClientRect();
    return r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2 } : { cx: 0, cy: 0 };
  };

  const begin = (mode: "move" | "scale") => (e: React.PointerEvent) => {
    if (!interactive || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    actions.select(clip.id, e.shiftKey);
    const { cx, cy } = centre();
    drag.current = {
      mode,
      px: e.clientX,
      py: e.clientY,
      x: clip.props.x,
      y: clip.props.y,
      scale: clip.props.scale,
      dist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") {
      const dx = (e.clientX - d.px) / stageScale;
      const dy = (e.clientY - d.py) / stageScale;
      actions.updateClipProps(clip.id, { x: Math.round(d.x + dx), y: Math.round(d.y + dy) }, { preview: true });
    } else {
      const { cx, cy } = centre();
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      actions.updateClipProps(clip.id, { scale: clamp(Math.round(d.scale * (dist / d.dist)), 1, 400) }, { preview: true });
    }
  };

  const end = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    actions.commit();
  };

  const geometry: CSSProperties = isText
    ? { left: "50%", top: "50%", maxWidth: project.width * 0.92, transform: layerTransform(v, true) }
    : { left: 0, top: 0, width: project.width, height: project.height, transform: layerTransform(v, false) };

  const content: CSSProperties = {
    opacity: clamp(v.opacity, 0, 100) / 100,
    mixBlendMode: blendMode(clip),
    filter: filter || undefined,
  };

  return (
    <div
      ref={elRef}
      data-clip-id={clip.id}
      data-clip-label={clip.label}
      role="button"
      tabIndex={-1}
      aria-label={clip.label}
      onPointerDown={begin("move")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn("absolute touch-none select-none outline-none", interactive ? "cursor-move" : "cursor-default")}
      style={geometry}
    >
      {isText ? (
        <div className="whitespace-pre-wrap break-words px-[0.25em] py-[0.08em]" style={{ ...content, ...textStyle(clip.props.text!, project) }}>
          {clip.props.text!.content || clip.label}
        </div>
      ) : (
        <div className="absolute inset-0 overflow-hidden" style={content}>
          <MediaSurface clip={clip} time={time} url={url} kind={kind} playing={playing} muted={muted} labelSize={Math.max(11, Math.round(project.width * 0.012))} />
          {vignette > 0 && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ boxShadow: `inset 0 0 ${Math.round(project.width * 0.12)}px ${Math.round(project.width * 0.03)}px rgba(0,0,0,${(vignette / 100).toFixed(2)})` }}
            />
          )}
        </div>
      )}
      {selected && <SelectionFrame unit={1 / Math.max(0.02, stageScale * (v.scale / 100))} interactive={interactive} onHandle={begin("scale")} onMove={move} onUp={end} />}
    </div>
  );
}

// ── Picture ────────────────────────────────────────────────

interface MediaSurfaceProps {
  clip: Clip;
  time: number;
  url?: string;
  kind?: AssetKind;
  playing: boolean;
  muted: boolean;
  /** Font size of the fallback label, in canvas pixels. */
  labelSize: number;
}

/**
 * The picture itself. With a decoded file it is a real `<video>`/`<img>` kept
 * in sync with the playhead; without one it falls back to the clip tint so the
 * frame still reads after a reload.
 */
function MediaSurface({ clip, time, url, kind, playing, muted, labelSize }: MediaSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = !!url && kind !== "image";
  const target = clip.inPoint + Math.max(0, time - clip.start);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isVideo) return;
    if (playing) {
      if (Math.abs(el.currentTime - target) > 0.3) el.currentTime = target;
      if (el.paused) void el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - target) > 0.02) el.currentTime = target;
    }
  }, [target, playing, isVideo]);

  if (url && kind === "image") {
    return <img src={url} alt={clip.label} draggable={false} className="pointer-events-none h-full w-full object-cover" />;
  }
  if (isVideo) {
    return (
      <video
        ref={videoRef}
        src={url}
        muted={muted}
        playsInline
        preload="auto"
        className="pointer-events-none h-full w-full object-cover"
      />
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: tintBackground(clip, time) }}>
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,.45)" }} />
      <span
        className="absolute bottom-0 left-0 max-w-[70%] truncate rounded-[4px] bg-black/35 font-mono text-white/70"
        style={{ margin: labelSize, padding: `${labelSize * 0.25}px ${labelSize * 0.5}px`, fontSize: labelSize, borderRadius: labelSize * 0.35 }}
      >
        {clip.label}
      </span>
    </div>
  );
}

// ── Selection ──────────────────────────────────────────────

interface SelectionFrameProps {
  /** Canvas pixels per screen pixel, so the chrome stays ~1px wide on screen. */
  unit: number;
  interactive: boolean;
  onHandle: (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: (e: React.PointerEvent) => void;
}

/** Screen pixels of the visible handle square and of its (larger) hit target. */
const HANDLE_PX = 9;
const HANDLE_HIT_PX = 22;

function SelectionFrame({ unit, interactive, onHandle, onMove, onUp }: SelectionFrameProps) {
  const size = HANDLE_PX * unit;
  // A full-frame clip puts its corners on the stage edge, where the stage
  // clips half of every handle; the wider hit target keeps the inner part
  // comfortably grabbable.
  const hit = HANDLE_HIT_PX * unit;
  const corners: { key: string; style: CSSProperties; cursor: string }[] = [
    { key: "tl", style: { left: -hit / 2, top: -hit / 2 }, cursor: "nwse-resize" },
    { key: "tr", style: { right: -hit / 2, top: -hit / 2 }, cursor: "nesw-resize" },
    { key: "bl", style: { left: -hit / 2, bottom: -hit / 2 }, cursor: "nesw-resize" },
    { key: "br", style: { right: -hit / 2, bottom: -hit / 2 }, cursor: "nwse-resize" },
  ];
  return (
    <>
      <div
        data-selection-frame
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: `0 0 0 ${(1.5 * unit).toFixed(2)}px var(--foreground)` }}
      />
      {interactive &&
        corners.map((c) => (
          <div
            key={c.key}
            data-selection-handle={c.key}
            onPointerDown={onHandle}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="absolute grid touch-none place-items-center"
            style={{ ...c.style, width: hit, height: hit, cursor: c.cursor }}
          >
            <div
              className="bg-background"
              style={{
                width: size,
                height: size,
                borderRadius: 2 * unit,
                border: `${(1.2 * unit).toFixed(2)}px solid var(--foreground)`,
              }}
            />
          </div>
        ))}
    </>
  );
}
