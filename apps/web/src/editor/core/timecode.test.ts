import { describe, expect, it } from "vitest";
import { parseTimecode, timecode } from "./seed";

describe("timecode", () => {
  it("never drops a frame to float error", () => {
    expect(timecode(10 + 1 / 30, 30)).toBe("00:00:10.01");
    expect(timecode(0.1 + 0.2, 30)).toBe("00:00:00.09");
    expect(timecode(3661.5, 30)).toBe("01:01:01.15");
  });
  it("round-trips through parseTimecode frame by frame", () => {
    for (let f = 0; f < 90; f++) {
      const t = f / 30;
      expect(parseTimecode(timecode(t, 30), 30)).toBeCloseTo(t, 6);
    }
  });
  it("rejects malformed input", () => {
    expect(parseTimecode("1:2:3:4:5")).toBeNull();
    expect(parseTimecode("abc")).toBeNull();
    expect(parseTimecode("1.5:00")).toBeNull();
    expect(parseTimecode("")).toBeNull();
  });
  it("accepts frames and short forms", () => {
    expect(parseTimecode("150f", 30)).toBe(5);
    expect(parseTimecode("00:00:12.15", 30)).toBeCloseTo(12.5, 6);
    expect(parseTimecode("1:05", 30)).toBe(65);
  });
});

describe("seedIfEmpty", () => {
  it("seeds once and never resurrects deleted samples", async () => {
    const { seedIfEmpty, listProjects, deleteProject, memoryStorage } = await import("./persistence");
    const st = memoryStorage();
    seedIfEmpty(st);
    expect(listProjects(st).length).toBe(6);
    for (const p of listProjects(st)) deleteProject(p.id, st);
    expect(listProjects(st).length).toBe(0);
    seedIfEmpty(st);
    expect(listProjects(st).length).toBe(0);
  });
});

describe("locked tracks, duplicate, bookmarks", () => {
  it("locked track blocks split/delete/trim/duplicate/mute", async () => {
    const D = await import("./document");
    const { PROJECTS, ASSETS, TRACKS, CLIPS } = await import("./seed");
    const base = { project: PROJECTS[0], assets: ASSETS, tracks: TRACKS, clips: CLIPS, bookmarks: [] };
    const locked = D.toggleTrack(base, "t-v2", "locked");
    expect(D.splitClips(locked, ["c6"], 34).doc.clips.length).toBe(locked.clips.length);
    expect(D.deleteClips(locked, ["c6"], false).clips.length).toBe(locked.clips.length);
    expect(D.trimClip(locked, "c6", "end", -2, false)).toBe(locked);
    expect(D.duplicateClip(locked, "c6").doc.clips.length).toBe(locked.clips.length);
    expect(D.toggleClipsMuted(locked, ["c6"])).toBe(locked);
    // unlocked still works
    expect(D.splitClips(base, ["c6"], 34).doc.clips.length).toBe(base.clips.length + 1);
  });
  it("duplicate only pushes later clips by the overlap", async () => {
    const D = await import("./document");
    const { PROJECTS, ASSETS, TRACKS, CLIPS } = await import("./seed");
    const base = { project: PROJECTS[0], assets: ASSETS, tracks: TRACKS, clips: CLIPS, bookmarks: [] };
    // c5 14–20.2 on t-v2, c6 starts at 30: the copy (20.2–26.4) fits in the gap.
    const { doc } = D.duplicateClip(base, "c5");
    expect(D.clipById(doc, "c6")?.start).toBe(30);
  });
  it("does not stack bookmarks on the same frame", async () => {
    const D = await import("./document");
    const { PROJECTS, ASSETS, TRACKS, CLIPS } = await import("./seed");
    const base = { project: PROJECTS[0], assets: ASSETS, tracks: TRACKS, clips: CLIPS, bookmarks: [] };
    const once = D.addBookmark(base, 25).doc;
    const twice = D.addBookmark(once, 25 + 0.001);
    expect(twice.existed).toBe(true);
    expect(twice.doc.bookmarks.length).toBe(1);
  });
});
