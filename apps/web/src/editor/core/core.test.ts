import { describe, expect, it } from "vitest";
import { evaluateClip, interpolate } from "./animation";
import { addClipFromAsset, addKeyframe, deleteClips, splitClips, trimClip } from "./document";
import { createProject, listProjects, loadDocument, memoryStorage, saveDocument, seedIfEmpty } from "./persistence";
import { ASSETS, CLIPS, PROJECTS, TRACKS } from "./seed";
import { createEditorStore } from "./store";
import type { Document } from "./types";

const seedDoc = (): Document => ({
  project: structuredClone(PROJECTS[0]),
  assets: structuredClone(ASSETS),
  tracks: structuredClone(TRACKS),
  clips: structuredClone(CLIPS),
  bookmarks: [],
});
const clip = (doc: Document, id: string) => doc.clips.find((c) => c.id === id)!;

describe("store history", () => {
  it("split then undo restores the original clips", () => {
    const store = createEditorStore(seedDoc());
    const before = store.getState().doc;
    const rightIds = store.actions.splitClips(["c2"], 20);
    expect(rightIds).toHaveLength(1);
    expect(store.getState().doc.clips).toHaveLength(before.clips.length + 1);
    expect(store.getState().selection.clipIds).toEqual(rightIds);
    store.actions.undo();
    expect(store.getState().doc).toBe(before);
    expect(store.getState().selection.clipIds).toEqual([]);
    store.actions.redo();
    expect(store.getState().doc.clips).toHaveLength(before.clips.length + 1);
  });

  it("preview edits push one history entry on commit", () => {
    const store = createEditorStore(seedDoc());
    const before = store.getState().doc;
    store.actions.trimClip("c1", "end", -1, false, { preview: true });
    store.actions.trimClip("c1", "end", -2, false, { preview: true });
    expect(store.getState().history.past).toHaveLength(0);
    store.actions.commit();
    expect(store.getState().history.past).toHaveLength(1);
    store.actions.undo();
    expect(store.getState().doc).toBe(before);
  });
});

describe("document operations", () => {
  it("ripple delete closes the gap on the same track", () => {
    const doc = seedDoc();
    const next = deleteClips(doc, ["c2"], true);
    expect(next.clips.find((c) => c.id === "c2")).toBeUndefined();
    expect(clip(next, "c3").start).toBeCloseTo(12.4, 5);
    expect(clip(next, "c4").start).toBeCloseTo(62 - 41, 5);
    // other tracks untouched
    expect(clip(next, "c5").start).toBe(14);
  });

  it("trim clamps to the source length", () => {
    const doc = seedDoc();
    // c5: broll_keyboard (22.6s source), inPoint 2, duration 6.2 → max duration 20.6
    const next = trimClip(doc, "c5", "end", 100, true);
    expect(clip(next, "c5").duration).toBeCloseTo(20.6, 5);
    // without ripple the neighbour (c6 at 30s) clamps first
    expect(clip(trimClip(doc, "c5", "end", 100, false), "c5").duration).toBeCloseTo(16, 5);
    // start edge cannot go before the source start (inPoint ≥ 0)
    const next2 = trimClip(doc, "c5", "start", -10, false);
    expect(clip(next2, "c5").inPoint).toBe(0);
    expect(clip(next2, "c5").start).toBeCloseTo(12, 5);
  });

  it("split keeps total duration and keyframes on both halves", () => {
    const doc = seedDoc();
    const { doc: next, rightIds } = splitClips(doc, ["c6"], 34.5);
    const left = clip(next, "c6");
    const right = clip(next, rightIds[0]);
    expect(left.duration + right.duration).toBeCloseTo(9, 5);
    expect(right.inPoint).toBeCloseTo(4.5, 5);
    expect(left.props.keyframes.opacity?.length).toBe(2);
    expect(right.props.keyframes.opacity?.map((k) => k.time)).toEqual([expect.closeTo(3.7, 5), expect.closeTo(4.5, 5)]);
  });

  it("addClipFromAsset pushes an overlapping clip to the right", () => {
    const doc = seedDoc();
    // drop a 22.6s clip on Video 2 at 10s: c5 (14–20.2) overlaps and moves to 32.6, c6 (30) follows by the same delta
    const { doc: next, clip: added } = addClipFromAsset(doc, "a11", "t-v2", 10);
    expect(added?.trackId).toBe("t-v2");
    expect(clip(next, "c5").start).toBeCloseTo(32.6, 5);
    expect(clip(next, "c6").start).toBeCloseTo(30 + (32.6 - 14), 5);
    // "auto" picks a compatible track
    const auto = addClipFromAsset(doc, "a6", "auto", 0);
    expect(next.tracks.find((t) => t.id === auto.clip?.trackId)?.kind).toBe("audio");
  });
});

describe("animation", () => {
  it("interpolates linearly at the midpoint", () => {
    const kfs = [
      { id: "a", time: 0, value: 0, easing: "linear" as const },
      { id: "b", time: 2, value: 100, easing: "linear" as const },
    ];
    expect(interpolate(kfs, 1, 50)).toBeCloseTo(50, 5);
    expect(interpolate(kfs, -1, 7)).toBe(0);
    expect(interpolate(kfs, 5, 7)).toBe(100);
    expect(interpolate(undefined, 1, 7)).toBe(7);
  });

  it("evaluateClip uses props as base and keyframes as override", () => {
    const doc = seedDoc();
    const { doc: next } = addKeyframe(addKeyframe(doc, "c1", "scale", 0, 50).doc, "c1", "scale", 2, 150, "linear");
    const c = clip(next, "c1");
    expect(evaluateClip(c, c.start + 1).scale).toBeCloseTo(100, 3);
    expect(evaluateClip(c, c.start + 1).opacity).toBe(100);
    // a keyframe within half a frame replaces instead of adding
    const again = addKeyframe(next, "c1", "scale", 2.01, 120);
    expect(clip(again.doc, "c1").props.keyframes.scale).toHaveLength(2);
    expect(clip(again.doc, "c1").props.keyframes.scale?.[1].value).toBe(120);
  });
});

describe("persistence", () => {
  it("round-trips a document through a fake localStorage", () => {
    const storage = memoryStorage();
    seedIfEmpty(storage);
    const list = listProjects(storage);
    expect(list).toHaveLength(6);
    expect(list.find((p) => p.id === "p1")?.clipCount).toBe(CLIPS.length);
    const doc = loadDocument("p1", storage)!;
    expect(doc.clips).toEqual(CLIPS);
    const edited = deleteClips(doc, ["c1"], false);
    const saved = saveDocument(edited, storage);
    expect(loadDocument("p1", storage)?.clips).toHaveLength(CLIPS.length - 1);
    expect(listProjects(storage)[0].id).toBe("p1");
    expect(listProjects(storage)[0].updatedAt).toBe(saved.project.updatedAt);
    const created = createProject({ name: "New", aspect: "9:16" }, storage);
    expect(created.project.width).toBe(1080);
    expect(loadDocument(created.project.id, storage)?.project.name).toBe("New");
    expect(listProjects(storage)).toHaveLength(7);
  });
});
