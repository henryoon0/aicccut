/**
 * rAF-driven playback clock over a TimeStore. Rate is signed (JKL shuttle),
 * playback wraps or stops at the in/out range. State that changes rarely
 * (playing, rate, loop, in/out) is exposed as a tiny external store.
 */
import { useSyncExternalStore } from "react";
import { useEditorContext } from "./context";
import type { TimeStore } from "./time-store";

export interface TransportState {
  playing: boolean;
  /** Signed rate; 0 while paused. */
  rate: number;
  loop: boolean;
  inPoint: number | null;
  outPoint: number | null;
}

export interface Transport {
  getState(): TransportState;
  subscribe(fn: (s: TransportState) => void): () => void;
  /** Start playing at `rate` (default 1, or the last shuttle rate when non-zero). */
  play(rate?: number): void;
  pause(): void;
  /** Pause when playing, otherwise play at 1×. */
  toggle(): void;
  /** Set the rate directly (-8..8); 0 pauses. */
  setRate(rate: number): void;
  /** JKL shuttle: -1 doubles backwards speed, +1 doubles forwards; crossing zero starts at 1×. */
  shuttle(dir: -1 | 1): void;
  /** Pause and move by n frames (negative = back). */
  stepFrames(n: number): void;
  /** Jump to t (clamped to the document). */
  seek(t: number): void;
  goToStart(): void;
  goToEnd(): void;
  setLoop(v: boolean): void;
  toggleLoop(): void;
  setIn(t: number | null): void;
  setOut(t: number | null): void;
  clearInOut(): void;
  /** Stop the rAF loop; call on unmount. */
  dispose(): void;
}

export const MAX_RATE = 8;
export const RATES = [-8, -4, -2, -1, 0, 1, 2, 4, 8];

/** Create a transport bound to a time store; `fps` may be a getter so project changes apply live. */
export function createTransport(time: TimeStore, getDuration: () => number, fps: number | (() => number)): Transport {
  const getFps = typeof fps === "function" ? fps : () => fps;
  const frame = () => 1 / getFps();
  let state: TransportState = { playing: false, rate: 0, loop: false, inPoint: null, outPoint: null };
  const listeners = new Set<(s: TransportState) => void>();
  let raf = 0;
  let last = 0;

  const setState = (patch: Partial<TransportState>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l(state);
  };
  const range = () => ({ lo: state.inPoint ?? 0, hi: state.outPoint ?? getDuration() });
  const clampT = (t: number) => Math.min(getDuration(), Math.max(0, t));
  const stopLoop = () => {
    if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
    raf = 0;
  };

  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    const { lo, hi } = range();
    let t = time.get() + dt * state.rate;
    if (state.rate > 0 && t >= hi) {
      if (state.loop) t = lo + (t - hi);
      else return finish(hi);
    } else if (state.rate < 0 && t <= lo) {
      if (state.loop) t = hi - (lo - t);
      else return finish(lo);
    }
    time.set(t);
    raf = requestAnimationFrame(tick);
  };
  const finish = (t: number) => {
    time.set(t);
    raf = 0;
    setState({ playing: false, rate: 0 });
  };

  const pause = () => {
    stopLoop();
    time.set(Math.round(time.get() / frame()) * frame());
    setState({ playing: false, rate: 0 });
  };

  const setRate = (r: number) => {
    const rate = Math.max(-MAX_RATE, Math.min(MAX_RATE, r));
    if (rate === 0) return pause();
    if (typeof requestAnimationFrame !== "function") return;
    const { lo, hi } = range();
    const f = frame();
    if (rate > 0 && time.get() >= hi - f / 2) time.set(lo);
    if (rate < 0 && time.get() <= lo + f / 2) time.set(hi);
    setState({ playing: true, rate });
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  const transport: Transport = {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    play: (rate) => setRate(rate ?? 1),
    pause,
    toggle: () => (state.rate !== 0 ? pause() : setRate(1)),
    setRate,
    shuttle(dir) {
      const r = state.rate;
      if (r === 0 || Math.sign(r) !== dir) return setRate(dir);
      setRate(Math.min(MAX_RATE, Math.abs(r) * 2) * dir);
    },
    stepFrames(n) {
      pause();
      time.set(clampT(Math.round((time.get() + n * frame()) / frame()) * frame()));
    },
    seek: (t) => time.set(clampT(t)),
    goToStart: () => {
      pause();
      time.set(state.inPoint ?? 0);
    },
    goToEnd: () => {
      pause();
      time.set(state.outPoint ?? getDuration());
    },
    setLoop: (v) => setState({ loop: v }),
    toggleLoop: () => setState({ loop: !state.loop }),
    setIn: (t) => setState({ inPoint: t === null ? null : clampT(t) }),
    setOut: (t) => setState({ outPoint: t === null ? null : clampT(t) }),
    clearInOut: () => setState({ inPoint: null, outPoint: null }),
    dispose: () => stopLoop(),
  };
  return transport;
}

/** Transport state as React state. Falls back to the context transport. */
export function useTransportState(transport?: Transport): TransportState {
  const ctx = useEditorContext();
  const t = transport ?? ctx.transport;
  return useSyncExternalStore(t.subscribe, t.getState, t.getState);
}
