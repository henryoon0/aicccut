/**
 * localStorage persistence. Every function takes an optional `StorageLike`
 * so tests (and SSR) can pass a fake; without one, `globalThis.localStorage`
 * is used when present and every call becomes a no-op otherwise.
 *
 * Keys: `aicccut.projects` (Project[]), `aicccut.doc.<projectId>` (Document).
 */
import { useEffect } from "react";
import { documentDuration } from "./document";
import { newId } from "./ids";
import { ASPECT_SIZES, ASSETS, CLIPS, DEFAULT_FPS, PROJECTS, TINTS, TRACKS, defaultTracks } from "./seed";
import type { EditorStore } from "./store";
import type { Aspect, Document, Fps, Project } from "./types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const PROJECTS_KEY = "aicccut.projects";
export const docKey = (projectId: string) => `aicccut.doc.${projectId}`;

/** localStorage when available (browser), else null. */
export function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function readJson<T>(storage: StorageLike, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(storage: StorageLike, key: string, value: unknown) {
  storage.setItem(key, JSON.stringify(value));
}

export interface ProjectSummary extends Project {
  /** Timeline length in seconds, derived from the stored document. */
  duration: number;
  clipCount: number;
}

/** Projects newest-first, with duration/clip count read from their documents. */
export function listProjects(storage = defaultStorage()): ProjectSummary[] {
  if (!storage) return [];
  const projects = readJson<Project[]>(storage, PROJECTS_KEY) ?? [];
  return projects
    .map((p) => {
      const doc = readJson<Document>(storage, docKey(p.id));
      return { ...p, duration: doc ? documentDuration(doc) : 0, clipCount: doc?.clips.length ?? 0 };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function writeProjects(storage: StorageLike, projects: Project[]) {
  writeJson(storage, PROJECTS_KEY, projects);
}

export interface CreateProjectInput {
  name: string;
  aspect?: Aspect;
  fps?: Fps;
  /** Override the canvas size derived from `aspect`. */
  width?: number;
  height?: number;
  tint?: string;
}

/** Build an in-memory document for a new project (nothing is stored). */
export function newDocument(input: CreateProjectInput): Document {
  const aspect = input.aspect ?? "16:9";
  const size = ASPECT_SIZES[aspect];
  const now = new Date().toISOString();
  const project: Project = {
    id: newId("p"), name: input.name.trim() || "제목 없는 프로젝트", aspect, fps: input.fps ?? DEFAULT_FPS,
    width: input.width ?? size.width, height: input.height ?? size.height,
    createdAt: now, updatedAt: now, tint: input.tint ?? TINTS[Math.floor(Math.random() * TINTS.length)],
  };
  return { project, assets: [], tracks: defaultTracks(), clips: [], bookmarks: [] };
}

/** Create and store a project; returns its document. */
export function createProject(input: CreateProjectInput, storage = defaultStorage()): Document {
  const doc = newDocument(input);
  if (storage) {
    writeJson(storage, docKey(doc.project.id), doc);
    writeProjects(storage, [doc.project, ...(readJson<Project[]>(storage, PROJECTS_KEY) ?? [])]);
  }
  return doc;
}

/** Rename a project in the list and its document. */
export function renameProject(projectId: string, name: string, storage = defaultStorage()): void {
  if (!storage) return;
  const now = new Date().toISOString();
  const projects = (readJson<Project[]>(storage, PROJECTS_KEY) ?? []).map((p) => (p.id === projectId ? { ...p, name, updatedAt: now } : p));
  writeProjects(storage, projects);
  const doc = readJson<Document>(storage, docKey(projectId));
  if (doc) writeJson(storage, docKey(projectId), { ...doc, project: { ...doc.project, name, updatedAt: now } });
}

/** Copy a project and its document under a new id; returns the copy's document or null. */
export function duplicateProject(projectId: string, storage = defaultStorage()): Document | null {
  if (!storage) return null;
  const doc = readJson<Document>(storage, docKey(projectId));
  if (!doc) return null;
  const now = new Date().toISOString();
  const copy: Document = { ...doc, project: { ...doc.project, id: newId("p"), name: `${doc.project.name} 사본`, createdAt: now, updatedAt: now } };
  writeJson(storage, docKey(copy.project.id), copy);
  writeProjects(storage, [copy.project, ...(readJson<Project[]>(storage, PROJECTS_KEY) ?? [])]);
  return copy;
}

/** Remove a project and its document. */
export function deleteProject(projectId: string, storage = defaultStorage()): void {
  if (!storage) return;
  writeProjects(storage, (readJson<Project[]>(storage, PROJECTS_KEY) ?? []).filter((p) => p.id !== projectId));
  storage.removeItem(docKey(projectId));
}

/** Load a project's document, or null when missing. */
export function loadDocument(projectId: string, storage = defaultStorage()): Document | null {
  return storage ? readJson<Document>(storage, docKey(projectId)) : null;
}

/** Save a document and bump its project's `updatedAt` in the list. Returns the saved document. */
export function saveDocument(doc: Document, storage = defaultStorage()): Document {
  const saved: Document = { ...doc, project: { ...doc.project, updatedAt: new Date().toISOString() } };
  if (!storage) return saved;
  writeJson(storage, docKey(saved.project.id), saved);
  const projects = readJson<Project[]>(storage, PROJECTS_KEY) ?? [];
  const idx = projects.findIndex((p) => p.id === saved.project.id);
  if (idx === -1) projects.unshift(saved.project);
  else projects[idx] = saved.project;
  writeProjects(storage, projects);
  return saved;
}

/** Trailing-edge debounce of `saveDocument`. Returns { schedule, flush, cancel }. */
export function createAutosaver(delayMs = 800, storage = defaultStorage()) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Document | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending) saveDocument(pending, storage);
    pending = null;
  };
  return {
    schedule(doc: Document) {
      pending = doc;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

/** Autosave the store's document to localStorage (debounced); flushes on unmount. */
export function useAutosave(store: EditorStore, delayMs = 800): void {
  useEffect(() => {
    const saver = createAutosaver(delayMs);
    let lastDoc = store.getState().doc;
    const unsub = store.subscribe((s) => {
      if (s.doc === lastDoc) return;
      lastDoc = s.doc;
      saver.schedule(s.doc);
    });
    return () => {
      unsub();
      saver.flush();
    };
  }, [store, delayMs]);
}

/** Set once the sample projects have been written, so deleting them all sticks. */
export const SEEDED_KEY = "aicccut.seeded";

/** Write the 6 seed projects on first run. The first gets the full timeline, the rest assets only. */
export function seedIfEmpty(storage = defaultStorage()): void {
  if (!storage) return;
  if (storage.getItem(SEEDED_KEY)) return;
  if ((readJson<Project[]>(storage, PROJECTS_KEY) ?? []).length) {
    storage.setItem(SEEDED_KEY, "1");
    return;
  }
  for (const [i, project] of PROJECTS.entries()) {
    const doc: Document = {
      project, assets: structuredClone(ASSETS), tracks: structuredClone(TRACKS),
      clips: i === 0 ? structuredClone(CLIPS) : [], bookmarks: [],
    };
    writeJson(storage, docKey(project.id), doc);
  }
  writeProjects(storage, PROJECTS);
  storage.setItem(SEEDED_KEY, "1");
}

/** In-memory StorageLike for tests and SSR fallbacks. */
export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}
