import { useCallback, useEffect, useRef, useState } from "react";
import { CLIPS, PROJECT_DURATION, type Clip } from "#/prototypes/mock";

export const FPS = 30;
export const FRAME = 1 / FPS;
export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const snapFrame = (t: number) => Math.round(t * FPS) / FPS;

export interface Playback {
  time: number;
  playing: boolean;
  /** Signed playback rate; 0 while stopped. */
  rate: number;
  loop: boolean;
  inPoint: number | null;
  outPoint: number | null;
  play: (rate?: number) => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  step: (frames: number) => void;
  setLoop: (v: boolean) => void;
  setIn: (t: number | null) => void;
  setOut: (t: number | null) => void;
}

/** rAF-driven clock over PROJECT_DURATION. Rate can be negative (shuttle). */
export function usePlayback(initial = 3): Playback {
  const [time, setTimeState] = useState(initial);
  const [rate, setRateState] = useState(0);
  const [loop, setLoop] = useState(false);
  const [inPoint, setIn] = useState<number | null>(null);
  const [outPoint, setOut] = useState<number | null>(null);

  const timeRef = useRef(initial);
  const rateRef = useRef(0);
  const loopRef = useRef(false);
  const rangeRef = useRef<[number | null, number | null]>([null, null]);
  const raf = useRef(0);
  const last = useRef(0);

  loopRef.current = loop;
  rangeRef.current = [inPoint, outPoint];

  const commit = useCallback((t: number) => {
    timeRef.current = t;
    setTimeState(t);
  }, []);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);

  const pause = useCallback(() => {
    stopLoop();
    rateRef.current = 0;
    setRateState(0);
    commit(snapFrame(timeRef.current));
  }, [commit, stopLoop]);

  const tick = useCallback(
    (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      const [i, o] = rangeRef.current;
      const lo = i ?? 0;
      const hi = o ?? PROJECT_DURATION;
      let t = timeRef.current + dt * rateRef.current;
      if (rateRef.current > 0 && t >= hi) {
        if (loopRef.current) t = lo;
        else {
          commit(hi);
          rateRef.current = 0;
          setRateState(0);
          raf.current = 0;
          return;
        }
      } else if (rateRef.current < 0 && t <= lo) {
        if (loopRef.current) t = hi;
        else {
          commit(lo);
          rateRef.current = 0;
          setRateState(0);
          raf.current = 0;
          return;
        }
      }
      commit(t);
      raf.current = requestAnimationFrame(tick);
    },
    [commit],
  );

  const play = useCallback(
    (r = 1) => {
      rateRef.current = r;
      setRateState(r);
      if (r === 0) {
        stopLoop();
        return;
      }
      // Restart from the range start when parked at the end.
      const [i, o] = rangeRef.current;
      const hi = o ?? PROJECT_DURATION;
      const lo = i ?? 0;
      if (r > 0 && timeRef.current >= hi - FRAME / 2) commit(lo);
      if (r < 0 && timeRef.current <= lo + FRAME / 2) commit(hi);
      if (!raf.current) {
        last.current = performance.now();
        raf.current = requestAnimationFrame(tick);
      }
    },
    [commit, stopLoop, tick],
  );

  const toggle = useCallback(() => {
    if (rateRef.current !== 0) pause();
    else play(1);
  }, [pause, play]);

  const seek = useCallback(
    (t: number) => {
      commit(clamp(t, 0, PROJECT_DURATION));
    },
    [commit],
  );

  const step = useCallback(
    (frames: number) => {
      pause();
      commit(clamp(snapFrame(timeRef.current + frames * FRAME), 0, PROJECT_DURATION));
    },
    [commit, pause],
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return {
    time,
    playing: rate !== 0,
    rate,
    loop,
    inPoint,
    outPoint,
    play,
    pause,
    toggle,
    seek,
    step,
    setLoop,
    setIn,
    setOut,
  };
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

/**
 * Space toggles, ←/→ step one frame (Shift: 10), Home/End jump. `extra` gets
 * every other key first and returns true when it handled the event.
 */
export function useTransportKeys(
  pb: Playback,
  extra?: (e: KeyboardEvent) => boolean | void,
  opts?: { space?: boolean },
) {
  const extraRef = useRef(extra);
  extraRef.current = extra;
  const pbRef = useRef(pb);
  pbRef.current = pb;
  const space = opts?.space ?? true;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (extraRef.current?.(e)) {
        e.preventDefault();
        return;
      }
      const p = pbRef.current;
      switch (e.key) {
        case " ":
          if (!space) return;
          e.preventDefault();
          p.toggle();
          break;
        // Frame stepping owns ←/→ here; stop the harness picker from also
        // switching variants on the same keys (it listens on document).
        case "ArrowLeft":
          e.preventDefault();
          e.stopPropagation();
          p.step(e.shiftKey ? -10 : -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          e.stopPropagation();
          p.step(e.shiftKey ? 10 : 1);
          break;
        case "Home":
          e.preventDefault();
          p.pause();
          p.seek(0);
          break;
        case "End":
          e.preventDefault();
          p.pause();
          p.seek(PROJECT_DURATION);
          break;
      }
    };
    // Capture phase: runs before document-level listeners.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [space]);
}

const within = (c: Clip, t: number) => t >= c.start && t < c.start + c.duration;

/** Top-most video clip (Video 2 over Video 1) and the active text clip. */
export function clipsAt(t: number) {
  const v2 = CLIPS.find((c) => c.trackId === "t-v2" && within(c, t));
  const v1 = CLIPS.find((c) => c.trackId === "t-v1" && within(c, t));
  const text = CLIPS.find((c) => c.trackId === "t-text" && within(c, t));
  const fx = CLIPS.find((c) => c.trackId === "t-fx" && within(c, t));
  return { video: v2 ?? v1, under: v2 ? v1 : undefined, text, fx };
}

/** Deterministic tint gradient for the "video" at time t. */
export function frameStyle(t: number): React.CSSProperties {
  const { video, under, fx } = clipsAt(t);
  const tint = video?.tint ?? "#1f2937";
  const second = under?.tint ?? "#0b1020";
  // Slow drift so playback visibly changes the picture.
  const local = video ? t - video.start : t;
  const angle = 120 + Math.sin(local * 0.6) * 25;
  const pos = 50 + Math.sin(local * 0.9) * 20;
  return {
    backgroundImage: `radial-gradient(ellipse at ${pos}% 35%, ${tint}cc 0%, transparent 55%), linear-gradient(${angle}deg, ${tint} 0%, ${second} 100%)`,
    filter: fx ? "blur(6px)" : undefined,
  };
}

/** Parse "hh:mm:ss.ff", "mm:ss", "ss" or a bare frame count with 'f' suffix. */
export function parseTimecode(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+f$/i.test(s)) return Number(s.slice(0, -1)) / FPS;
  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || Number.isNaN(Number(p.replace(".", ""))))) return null;
  let sec = 0;
  const lastRaw = parts.pop() ?? "0";
  const [secPart, framePart] = lastRaw.split(".");
  sec += Number(secPart);
  if (framePart !== undefined) sec += Number(framePart.padEnd(2, "0").slice(0, 2)) / FPS;
  let mult = 60;
  while (parts.length) {
    sec += Number(parts.pop()) * mult;
    mult *= 60;
  }
  return clamp(sec, 0, PROJECT_DURATION);
}

/** Pseudo audio level 0..1 for meters, louder while voice clip is active. */
export function audioLevel(t: number, playing: boolean, channel: 0 | 1): number {
  if (!playing) return 0;
  const seed = t * (channel ? 7.3 : 6.1);
  const base = 0.45 + Math.sin(seed) * 0.2 + Math.sin(seed * 2.7) * 0.15 + Math.sin(seed * 11.1) * 0.1;
  return clamp(base, 0.05, 1);
}
