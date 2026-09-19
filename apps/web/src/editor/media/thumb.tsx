/**
 * Asset thumbnails. When the real file behind an asset is in memory
 * (`useAssetUrl`) the tile shows decoded media — images as `<img>`, videos as
 * a `<video>` parked on the frame at 1s, audio as its deterministic waveform.
 * Without a file (seeded assets, or after a reload) the tint stands in.
 */
import { useCallback, useMemo, type ReactNode } from "react";
import { cn } from "#/lib/utils";
import { fileSize, shortDuration, type Asset, type AssetKind } from "#/editor/core";
import { useAssetUrl } from "./files";
import { KIND_ICON, resolution, waveform } from "./helpers";

/** Seconds into a video the thumbnail frame is taken from. */
const THUMB_SEEK = 1;

export function KindIcon({ kind, size = 12, className }: { kind: AssetKind; size?: number; className?: string }) {
  const Icon = KIND_ICON[kind];
  return <Icon size={size} strokeWidth={1.75} className={className} />;
}

/** Metadata line: "3840×2160 · 30fps · 3m 04s · 2.43 GB". */
export function metaLine(a: Asset): string {
  const parts: string[] = [];
  if (a.width) parts.push(resolution(a));
  if (a.fps) parts.push(`${a.fps}fps`);
  if (a.kind !== "image") parts.push(shortDuration(a.duration));
  parts.push(fileSize(a.size));
  return parts.join(" · ");
}

function tintBackground(asset: Pick<Asset, "kind" | "tint">): string {
  return asset.kind === "audio"
    ? `color-mix(in oklab, ${asset.tint} 22%, var(--surface-3))`
    : `linear-gradient(135deg, ${asset.tint} 0%, color-mix(in oklab, ${asset.tint} 55%, #000) 100%)`;
}

interface ThumbProps {
  asset: Asset;
  className?: string;
  children?: ReactNode;
  /** Waveform bar count for audio; ~12 reads better in the small drag ghost. */
  bars?: number;
  /** Dim the media (used behind an import progress bar). */
  dim?: boolean;
}

/**
 * One asset preview. Always renders the tint as the backdrop so a slow decode
 * never flashes an empty box, then layers the decoded media on top.
 */
export function Thumb({ asset, className, children, bars: barCount = 32, dim }: ThumbProps) {
  const url = useAssetUrl(asset.id);
  const bars = useMemo(() => (asset.kind === "audio" ? waveform(asset.id, barCount) : null), [asset.id, asset.kind, barCount]);

  // Park the poster frame a second in; short clips fall back to their middle.
  const seek = useCallback((e: { currentTarget: HTMLVideoElement }) => {
    const v = e.currentTarget;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    const t = d > THUMB_SEEK ? THUMB_SEEK : d / 2;
    if (t > 0) v.currentTime = t;
  }, []);

  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: tintBackground(asset) }}>
      {bars && (
        <div className={cn("absolute inset-y-0 flex items-center gap-px", barCount <= 16 ? "inset-x-1" : "inset-x-2")}>
          {bars.map((v, i) => (
            <span key={i} className="flex-1 rounded-full" style={{ height: `${v * 70}%`, background: asset.tint }} />
          ))}
        </div>
      )}
      {asset.kind === "image" && !url && (
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 30%, #fff 0, transparent 45%)" }} />
      )}
      {url && asset.kind === "image" && (
        <img src={url} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      )}
      {url && asset.kind === "video" && (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          aria-hidden="true"
          onLoadedMetadata={seek}
          className="pointer-events-none absolute inset-0 size-full object-cover"
        />
      )}
      {dim && <div className="absolute inset-0 bg-black/45" />}
      {children}
    </div>
  );
}
