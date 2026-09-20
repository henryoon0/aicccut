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

/** Resolves once the document is visible (immediately when it already is). */
function whenVisible(): Promise<void> {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") return Promise.resolve();
  return new Promise((resolve) => {
    const on = () => {
      if (document.visibilityState === "hidden") return;
      document.removeEventListener("visibilitychange", on);
      resolve();
    };
    document.addEventListener("visibilitychange", on);
  });
}

/** How long a visible tab may keep a media element loading before we give up on its metadata. */
const PROBE_TIMEOUT_MS = 15_000;

/**
 * Read duration / dimensions from a media file via a detached element.
 *
 * Chrome defers loading media in a background tab until it becomes visible
 * again, so video/audio probing waits for visibility first (images decode
 * either way). Resolves with zeros when the browser cannot decode the file
 * or when a visible tab still has no metadata after PROBE_TIMEOUT_MS.
 */
export function probeMediaFile(file: File): Promise<{ duration: number; width?: number; height?: number }> {
  if (file.type.startsWith("image/")) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const done = (r: { duration: number; width?: number; height?: number }) => {
        URL.revokeObjectURL(url);
        resolve(r);
      };
      const img = new Image();
      img.onload = () => done({ duration: 0, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done({ duration: 0 });
      img.src = url;
    });
  }
  return whenVisible().then(
    () =>
      new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        let settled = false;
        const done = (r: { duration: number; width?: number; height?: number }) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          URL.revokeObjectURL(url);
          resolve(r);
        };
        const el = document.createElement(file.type.startsWith("audio/") ? "audio" : "video") as HTMLVideoElement;
        el.preload = "metadata";
        el.onloadedmetadata = () =>
          done({ duration: Number.isFinite(el.duration) ? el.duration : 0, width: el.videoWidth || undefined, height: el.videoHeight || undefined });
        el.onerror = () => done({ duration: 0 });
        const timer = setTimeout(() => done({ duration: 0 }), PROBE_TIMEOUT_MS);
        el.src = url;
      }),
  );
}

/** True while the tab is hidden and media probes are therefore parked. */
export function useDocumentHidden(): boolean {
  return useSyncExternalStore(
    (l) => {
      document.addEventListener("visibilitychange", l);
      return () => document.removeEventListener("visibilitychange", l);
    },
    () => document.visibilityState === "hidden",
    () => false,
  );
}
