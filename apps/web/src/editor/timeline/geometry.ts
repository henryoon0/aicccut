/**
 * Pure layout maths for the timeline: fixed sizes, ruler tick spacing,
 * deterministic clip decoration and pointer hit-testing. No React, no state.
 */
import type { CSSProperties } from "react";

/** Width of the sticky track-header column. */
export const HEADER_W = 208;
export const RULER_H = 28;
/** Default and expanded track heights (the header's ▾ toggle flips between them). */
export const TRACK_H = 44;
export const TRACK_H_TALL = 76;
/** One keyframe property lane under the selected clip's track. */
export const LANE_H = 20;
/** Snap radius in pixels; converted to seconds with the current zoom. */
export const SNAP_PX = 8;
/** Spare content width past the last clip so clips can be dragged beyond the end. */
export const TAIL_PX = 160;
/** Pointer travel before a clip press turns into a drag. */
export const DRAG_SLOP = 3;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Major / minor tick spacing in seconds for a zoom level. */
export function tickSpec(pps: number, minMajorPx = 72): { major: number; minor: number } {
  const majors: [number, number][] = [
    [0.5, 0.1], [1, 0.2], [2, 0.5], [5, 1], [10, 2], [15, 5], [30, 10], [60, 15], [120, 30], [300, 60],
  ];
  const hit = majors.find(([m]) => m * pps >= minMajorPx) ?? majors[majors.length - 1];
  return { major: hit[0], minor: hit[1] };
}

/** Tick times from 0 to `end` every `step` seconds. */
export function range(step: number, end: number): number[] {
  const out: number[] = [];
  const max = Math.min(end, step * 4000);
  for (let t = 0; t <= max + 1e-6; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
}

/** "m:ss" ruler label. */
export function shortTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Deterministic PRNG so a clip's waveform never changes between renders. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable numeric seed for a clip id. */
export function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Filmstrip background for a video clip, tinted with the clip's colour. */
export function filmstripStyle(tint: string, frameW: number): CSSProperties {
  const half = frameW / 2;
  return {
    backgroundColor: tint,
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0) 45%, rgba(0,0,0,.28)), repeating-linear-gradient(90deg, color-mix(in srgb, ${tint} 78%, black) 0 ${half}px, color-mix(in srgb, ${tint} 88%, white) ${half}px ${frameW - 1}px, rgba(0,0,0,.45) ${frameW - 1}px ${frameW}px)`,
  };
}

/** Bar heights (0–1) for a clip's fake waveform. */
export function waveformBars(seed: number, seconds: number, density = 6): number[] {
  const n = clamp(Math.round(seconds * density), 8, 900);
  const rnd = mulberry(seed);
  const out: number[] = [];
  let env = 0.5;
  for (let i = 0; i < n; i++) {
    env = clamp(env + (rnd() - 0.5) * 0.35, 0.15, 1);
    out.push(clamp(env * (0.55 + rnd() * 0.6), 0.06, 1));
  }
  return out;
}

/** Track id of the row under a client Y position, or null. */
export function trackAtPoint(rows: HTMLElement | null, clientY: number): string | null {
  if (!rows) return null;
  const nodes = rows.querySelectorAll<HTMLElement>("[data-track-row]");
  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    if (clientY >= r.top && clientY <= r.bottom) return node.dataset.trackRow ?? null;
  }
  return null;
}

/** "+1.2 s" / "−0.4 s" for trim readouts. */
export const formatDelta = (d: number, digits = 2) => `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(digits)} s`;
