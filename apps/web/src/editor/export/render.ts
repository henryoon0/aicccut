/**
 * The render walk.
 *
 * There is no video encoder in this build, so nothing here writes pixels.
 * What it does do is real: it steps the document frame by frame at the
 * chosen frame rate and, for every frame, asks `clipsAt` which clips are
 * live and `evaluateClip` what each of them looks like there. Progress, the
 * ETA, the frames-per-second readout and the thumbnail all come from that
 * walk rather than from a timer.
 *
 * The walk runs in requestAnimationFrame batches so the dialog stays
 * responsive and cancellable. Each batch is bounded twice: by a time budget,
 * and by one second of timeline per animation frame. The second bound is
 * pacing, not encoder speed — evaluating a frame costs microseconds, and
 * without it a 98-second document would finish before the bar could move.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { clipsAt, evaluateClip, type ChannelValues, type Clip, type Document } from "#/editor/core";
import { getAssetUrl } from "#/editor/media/files";

/** Milliseconds of walking allowed per animation frame. */
const BUDGET_MS = 4;

export type RenderStatus = "idle" | "rendering" | "done" | "cancelled";

/** What the walk found at one frame — everything the thumbnail needs. */
export interface RenderFrame {
  /** Timeline time of this frame, seconds. */
  time: number;
  /** Tint of the topmost visual clip, or the project's. */
  tint: string;
  /** Label of the topmost visual clip, empty when the frame is bare. */
  label: string;
  /** Evaluated channels of that clip, null when nothing is on screen. */
  values: ChannelValues | null;
  /** How many clips are live at this time, across every track. */
  layers: number;
  /** Asset under the head that has a real file loaded, when there is one. */
  assetId?: string;
  /** Time inside that asset's source, seconds. */
  sourceTime: number;
}

export interface RenderState {
  status: RenderStatus;
  /** 0–1. */
  progress: number;
  /** Seconds remaining, estimated from the frames done so far. */
  eta: number;
  /** Frames walked per second. */
  fps: number;
  frame: number;
  totalFrames: number;
  frameInfo: RenderFrame;
}

export interface RenderPlan {
  /** Timeline second to start at. */
  startTime: number;
  /** Length to walk, seconds. */
  seconds: number;
  /** Frames per second to step at. */
  fps: number;
}

function emptyFrame(tint: string, time = 0): RenderFrame {
  return { time, tint, label: "", values: null, layers: 0, sourceTime: 0 };
}

const IDLE: RenderState = {
  status: "idle", progress: 0, eta: 0, fps: 0, frame: 0, totalFrames: 0, frameInfo: emptyFrame("#5b6cff"),
};

/**
 * Build a sampler bound to one document. Track order and asset kinds are
 * resolved once; the returned function is what runs on every frame.
 */
export function createFrameSampler(doc: Document): (t: number) => RenderFrame {
  const order = new Map(doc.tracks.map((tr, i) => [tr.id, i]));
  const visual = new Set(doc.tracks.filter((tr) => tr.kind !== "audio" && !tr.hidden).map((tr) => tr.id));
  const assetKind = new Map(doc.assets.map((a) => [a.id, a.kind]));
  const projectTint = doc.project.tint;

  const rank = (c: Clip) => order.get(c.trackId) ?? Number.MAX_SAFE_INTEGER;

  return (t: number): RenderFrame => {
    const live = clipsAt(doc, t);
    let top: Clip | undefined;
    let source: Clip | undefined;
    for (const clip of live) {
      if (!visual.has(clip.trackId)) continue;
      if (!top || rank(clip) < rank(top)) top = clip;
      // The first video clip under the head whose file is actually loaded.
      if (clip.assetId && assetKind.get(clip.assetId) === "video" && getAssetUrl(clip.assetId)) {
        if (!source || rank(clip) < rank(source)) source = clip;
      }
    }
    // Evaluating every live clip is the real per-frame work a compositor does.
    let values: ChannelValues | null = null;
    for (const clip of live) {
      const v = evaluateClip(clip, t);
      if (top && clip.id === top.id) values = v;
    }
    return {
      time: t,
      tint: top?.tint ?? projectTint,
      label: top?.label ?? "",
      values,
      layers: live.length,
      assetId: source?.assetId,
      sourceTime: source ? source.inPoint + (t - source.start) : 0,
    };
  };
}

/**
 * Walk a document over a range. `start` begins the walk, `cancel` stops it on
 * the next animation frame, `reset` returns to idle. The walk stops by itself
 * when the component unmounts.
 */
export function useDocumentRender() {
  const [state, setState] = useState<RenderState>(IDLE);
  const raf = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (doc: Document, plan: RenderPlan) => {
      stop();
      const sample = createFrameSampler(doc);
      const total = Math.max(1, Math.round(plan.seconds * plan.fps));
      const step = plan.seconds / total;
      const maxPerTick = Math.max(1, Math.round(plan.fps));
      let frame = 0;
      let t0: number | null = null;

      setState({ ...IDLE, status: "rendering", totalFrames: total, frameInfo: sample(plan.startTime) });

      const tick = (now: number) => {
        raf.current = null;
        if (t0 === null) t0 = now;
        const deadline = now + BUDGET_MS;
        let info = sample(plan.startTime + frame * step);
        let walked = 0;
        while (frame < total && walked < maxPerTick && performance.now() < deadline) {
          frame += 1;
          walked += 1;
          info = sample(plan.startTime + frame * step);
        }
        const elapsed = Math.max(0.001, (performance.now() - t0) / 1000);
        const rate = frame / elapsed;
        const done = frame >= total;
        setState({
          status: done ? "done" : "rendering",
          progress: frame / total,
          eta: done ? 0 : Math.max(0, (total - frame) / Math.max(1, rate)),
          fps: Math.round(rate),
          frame,
          totalFrames: total,
          frameInfo: info,
        });
        if (!done) raf.current = requestAnimationFrame(tick);
      };

      raf.current = requestAnimationFrame(tick);
    },
    [stop],
  );

  const cancel = useCallback(() => {
    stop();
    setState((prev) => (prev.status === "rendering" ? { ...prev, status: "cancelled" } : prev));
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setState(IDLE);
  }, [stop]);

  return { state, start, cancel, reset };
}

export function etaLabel(seconds: number): string {
  if (seconds < 1) return "곧 완료";
  if (seconds < 60) return `${Math.ceil(seconds)}초 남음`;
  return `${Math.floor(seconds / 60)}분 ${String(Math.ceil(seconds % 60)).padStart(2, "0")}초 남음`;
}
