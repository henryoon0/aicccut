import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { timecode } from "#/editor/core";
import { useAssetUrl } from "#/editor/media/files";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import type { RenderFrame } from "./render";

/** How far the source video may drift before it is worth another seek. */
const SEEK_EPSILON = 0.2;

/**
 * A frame of the real video asset under the render head. Seeking costs a
 * decode, so the element only moves when it has drifted past the epsilon.
 */
function SourceFrame({ assetId, time }: { assetId: string; time: number }) {
  const url = useAssetUrl(assetId);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(time)) return;
    if (Math.abs(el.currentTime - time) < SEEK_EPSILON) return;
    try {
      el.currentTime = Math.max(0, time);
    } catch {
      // A source that has not loaded metadata yet rejects the seek; the next
      // frame tries again.
    }
  }, [time, url]);

  if (!url) return null;
  return (
    <video
      ref={ref}
      src={url}
      muted
      playsInline
      preload="metadata"
      aria-hidden
      className="absolute inset-0 size-full object-cover"
    />
  );
}

export interface FramePreviewProps {
  frame: RenderFrame;
  /** Canvas size, so clip offsets and blur can be expressed as a share of it. */
  canvas: { width: number; height: number };
  fps: number;
  /** Hide the timecode badge for audio-only formats. */
  showTimecode?: boolean;
  done?: boolean;
  className?: string;
}

/**
 * The thumbnail the render step watches: the tint of the topmost clip as a
 * backdrop, its label composited with the channel values `evaluateClip`
 * returned for this frame, and the real video frame on top when the asset's
 * file is loaded. Offsets and blur are container-query units, so the composite
 * scales with the thumbnail without measuring anything.
 */
export function FramePreview({ frame, canvas, fps, showTimecode = true, done, className }: FramePreviewProps) {
  const v = frame.values;
  const xPct = v ? (v.x / Math.max(1, canvas.width)) * 100 : 0;
  const yPct = v ? (v.y / Math.max(1, canvas.height)) * 100 : 0;
  const blurCqw = v ? (Math.max(0, v.blur) / Math.max(1, canvas.width)) * 100 : 0;

  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-black transition-colors duration-300", className)}
      style={{
        aspectRatio: `${canvas.width} / ${canvas.height}`,
        containerType: "inline-size",
        background: `radial-gradient(120% 120% at 20% 10%, ${frame.tint} 0%, #0b0d14 75%)`,
      }}
    >
      {frame.assetId && <SourceFrame assetId={frame.assetId} time={frame.sourceTime} />}

      {v && frame.label && (
        <div
          className="absolute inset-0 grid place-items-center will-change-transform"
          style={{
            transform: `translate(${xPct}%, ${yPct}%) scale(${v.scale / 100}) rotate(${v.rotation}deg)`,
            opacity: Math.max(0, Math.min(1, v.opacity / 100)),
            filter: blurCqw > 0.01 ? `blur(${blurCqw}cqw)` : undefined,
          }}
        >
          <span className="max-w-[80%] truncate rounded bg-black/35 px-[2cqw] py-[1cqw] text-[3.4cqw] font-medium text-white/90">
            {frame.label}
          </span>
        </div>
      )}

      {frame.layers > 0 && (
        <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[11px] tabular-nums text-white/80">
          레이어 {frame.layers}개
        </span>
      )}

      {showTimecode && (
        <span className="absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white">
          {timecode(frame.time, fps)}
        </span>
      )}

      {done && (
        <motion.span
          className="absolute inset-0 grid place-items-center bg-black/35"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={spring.slow}
        >
          <span className="grid size-12 place-items-center rounded-full bg-emerald-500 text-white">
            <Check size={24} strokeWidth={2.5} />
          </span>
        </motion.span>
      )}
    </div>
  );
}
