/**
 * Pure helpers for the media panel: kind detection, sorting, search,
 * resolution labels and the deterministic pseudo-waveform used for audio
 * tiles that have no decoded file.
 */
import { AudioLines, Film, Image as ImageIcon } from "lucide-react";
import type { IconComponent } from "#/lib/icon-context.tsx";
import { TINTS, type Asset, type AssetKind } from "#/editor/core";

export const KIND_ICON: Record<AssetKind, IconComponent> = { video: Film, audio: AudioLines, image: ImageIcon };
export const KIND_LABEL: Record<AssetKind, string> = { video: "Video", audio: "Audio", image: "Image" };
export const KIND_ORDER: AssetKind[] = ["video", "audio", "image"];

export const ACCEPT = "video/*,audio/*,image/*";

/** Asset kind from a File's MIME type (extension fallback for odd containers). */
export function kindFromFile(file: File): AssetKind | null {
  const t = file.type;
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("image/")) return "image";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "mkv", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "m4a", "ogg", "flac"].includes(ext)) return "audio";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"].includes(ext)) return "image";
  return null;
}

/** Tint for the n-th asset, cycling the seed palette. */
export function pickTint(index: number): string {
  return TINTS[((index % TINTS.length) + TINTS.length) % TINTS.length];
}

export function resolution(a: Pick<Asset, "width" | "height">): string {
  return a.width && a.height ? `${a.width}×${a.height}` : "—";
}

export function shortRes(a: Pick<Asset, "width" | "height">): string | null {
  if (!a.width || !a.height) return null;
  const long = Math.max(a.width, a.height);
  if (long >= 3840) return "4K";
  if (long >= 2560) return "2.5K";
  if (long >= 1920) return "1080p";
  return `${a.height}p`;
}

export type SortKey = "added" | "name" | "kind" | "duration" | "size";
export type SortDir = "asc" | "desc";
export const SORT_KEYS: SortKey[] = ["added", "name", "kind", "duration", "size"];
export const SORT_LABEL: Record<SortKey, string> = { added: "Date added", name: "Name", kind: "Kind", duration: "Duration", size: "Size" };
/** Trigger labels: the flyout is 280px, so the button cannot carry "Date added". */
export const SORT_SHORT: Record<SortKey, string> = { added: "Added", name: "Name", kind: "Kind", duration: "Length", size: "Size" };

export function sortAssets(list: Asset[], key: SortKey, dir: SortDir): Asset[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let r = 0;
    switch (key) {
      case "name": r = a.name.localeCompare(b.name); break;
      case "kind": r = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name); break;
      case "duration": r = a.duration - b.duration; break;
      case "size": r = a.size - b.size; break;
      case "added": r = a.addedAt.localeCompare(b.addedAt); break;
    }
    return r * sign;
  });
}

export function matchesQuery(a: Asset, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [a.name, a.kind, resolution(a), shortRes(a) ?? "", a.fps ? `${a.fps}fps` : ""].join(" ").toLowerCase();
  return s.split(/\s+/).every((w) => hay.includes(w));
}

/** Deterministic pseudo-waveform for audio tiles without a decoded file. */
export function waveform(seed: string, n = 32): number[] {
  let h = 2166136261;
  for (const ch of seed) h = (h ^ ch.charCodeAt(0)) * 16777619;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(Math.round((0.25 + (((h >> 8) % 1000) / 1000) * 0.75) * 100) / 100);
  }
  return out;
}
