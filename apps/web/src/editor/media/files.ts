import { useSyncExternalStore } from "react";

/**
 * In-memory registry of the real File objects behind assets. Files are not
 * persisted; after a reload an asset falls back to its tint.
 */
const files = new Map<string, { file: File; url: string }>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  listeners.forEach((l) => l());
}

/** Register a dropped/picked file for an asset id and return its object URL. */
export function registerAssetFile(assetId: string, file: File): string {
  const prev = files.get(assetId);
  if (prev) URL.revokeObjectURL(prev.url);
  const url = URL.createObjectURL(file);
  files.set(assetId, { file, url });
  emit();
  return url;
}

/** Drop the file for an asset (revokes its object URL). */
export function releaseAssetFile(assetId: string) {
  const prev = files.get(assetId);
  if (!prev) return;
  URL.revokeObjectURL(prev.url);
  files.delete(assetId);
  emit();
}

/** Object URL for an asset's file, or undefined when none is loaded. */
export function getAssetUrl(assetId: string): string | undefined {
  return files.get(assetId)?.url;
}

/** Original File for an asset, or undefined. */
export function getAssetFile(assetId: string): File | undefined {
  return files.get(assetId)?.file;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Reactive object URL for an asset; re-renders when files are added/removed. */
export function useAssetUrl(assetId: string | undefined): string | undefined {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return assetId ? getAssetUrl(assetId) : undefined;
}

/**
 * Read duration / dimensions from a media file via a detached element.
 * Resolves with zeros when the browser cannot decode it.
 */
export function probeMediaFile(file: File): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (r: { duration: number; width?: number; height?: number }) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => done({ duration: 0, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done({ duration: 0 });
      img.src = url;
      return;
    }
    const el = document.createElement(file.type.startsWith("audio/") ? "audio" : "video") as HTMLVideoElement;
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      done({ duration: el.duration || 0, width: el.videoWidth || undefined, height: el.videoHeight || undefined });
    el.onerror = () => done({ duration: 0 });
    el.src = url;
  });
}
