/**
 * The playhead lives outside React state because it changes 60×/s during
 * playback. Components that must animate subscribe and write to the DOM
 * directly (`usePlayhead()`); components that merely display it and can
 * afford a re-render use `useTime()`.
 */
import { useSyncExternalStore } from "react";
import { useEditorContext } from "./context";

export type TimeListener = (t: number) => void;

export class TimeStore {
  private t: number;
  private max = Infinity;
  private listeners = new Set<TimeListener>();

  constructor(initial = 0) {
    this.t = Math.max(0, initial);
  }

  /** Current playhead in seconds. */
  get(): number {
    return this.t;
  }

  /** Move the playhead (clamped to [0, max]) and notify subscribers synchronously. */
  set(t: number): void {
    const next = Math.min(this.max, Math.max(0, Number.isFinite(t) ? t : 0));
    if (next === this.t) return;
    this.t = next;
    for (const l of this.listeners) l(next);
  }

  /** Upper bound for `set` (usually the document duration). */
  setMax(max: number): void {
    this.max = Math.max(0, max);
    if (this.t > this.max) this.set(this.max);
  }

  /** Subscribe; the listener is called immediately with the current value. Returns unsubscribe. */
  subscribe(l: TimeListener): () => void {
    this.listeners.add(l);
    l(this.t);
    return () => {
      this.listeners.delete(l);
    };
  }
}

/** Playhead as React state (re-renders on every change). Falls back to the context store. */
export function useTime(store?: TimeStore): number {
  const ctx = useEditorContext();
  const s = store ?? ctx.time;
  return useSyncExternalStore(
    (cb) => s.subscribe(() => cb()),
    () => s.get(),
    () => s.get(),
  );
}

/** The context TimeStore itself, for components that write DOM transforms in a subscriber. */
export function usePlayhead(): TimeStore {
  return useEditorContext().time;
}
