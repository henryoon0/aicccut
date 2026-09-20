/**
 * Real file import for the media panel. Files arrive via drop, the hidden
 * picker or paste; each one is probed for duration/size, added to the
 * document as an asset and registered in the in-memory file map.
 *
 * Probing is fast, so the per-file bar animates to ~90% over 600ms while the
 * probe runs and snaps to 100% once the asset lands — the feedback is
 * readable instead of a flash.
 */
import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { useActions, useEditorStore, type AssetKind } from "#/editor/core";
import { probeMediaFile, registerAssetFile } from "./files";
import { ACCEPT, kindFromFile, pickTint } from "./helpers";

const BAR_MS = 600;
const SETTLE_MS = 120;

export interface PendingImport {
  id: string;
  name: string;
  size: number;
  kind: AssetKind;
  tint: string;
  /** 0..1 */
  progress: number;
}

let seq = 0;

/** Queue of in-flight imports plus the function that starts them. */
export function useImportFiles() {
  const actions = useActions();
  const store = useEditorStore();
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [done, setDone] = useState<{ id: number; count: number } | null>(null);
  const inflight = useRef(0);

  const setProgress = useCallback((id: string, progress: number) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, progress } : p)));
  }, []);

  const importOne = useCallback(
    async (entry: PendingImport, file: File) => {
      const started = performance.now();
      const probe = probeMediaFile(file);
      await new Promise<void>((resolve) => {
        const tick = () => {
          const p = Math.min(0.9, (performance.now() - started) / BAR_MS);
          setProgress(entry.id, p);
          if (p < 0.9) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      const meta = await probe;
      // Show the full bar first, then swap card for tile in one update — the
      // asset must not land while its progress card is still on screen.
      setProgress(entry.id, 1);
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      const asset = actions.addAsset({
        name: file.name,
        kind: entry.kind,
        duration: entry.kind === "image" ? 0 : meta.duration,
        width: meta.width,
        height: meta.height,
        size: file.size,
        tint: entry.tint,
      });
      registerAssetFile(asset.id, file);
      setPending((prev) => prev.filter((p) => p.id !== entry.id));
    },
    [actions, setProgress],
  );

  const importFiles = useCallback(
    async (input: Iterable<File>) => {
      const files = Array.from(input);
      const base = store.getState().doc.assets.length + inflight.current;
      const entries: { entry: PendingImport; file: File }[] = [];
      for (const file of files) {
        const kind = kindFromFile(file);
        if (!kind) continue;
        seq += 1;
        entries.push({
          file,
          entry: { id: `imp-${seq}`, name: file.name, size: file.size, kind, tint: pickTint(base + entries.length), progress: 0 },
        });
      }
      if (!entries.length) return 0;
      inflight.current += entries.length;
      setPending((prev) => [...prev, ...entries.map((e) => e.entry)]);
      await Promise.all(entries.map((e) => importOne(e.entry, e.file)));
      inflight.current -= entries.length;
      setDone({ id: seq, count: entries.length });
      return entries.length;
    },
    [importOne, store],
  );

  const clearDone = useCallback(() => setDone(null), []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 4000);
    return () => clearTimeout(t);
  }, [done]);

  return { pending, importFiles, done, clearDone };
}

function hasFiles(e: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

/**
 * More than one panel can be mounted (the library and the Audio rail), and
 * each installs its own window listeners. Marking the native event keeps a
 * single drop or paste from importing the same files twice: the first
 * listener to see it claims it, the rest skip.
 */
const CLAIMED = Symbol.for("aicccut.media.window-import");

function claim(e: Event): boolean {
  const ev = e as Event & { [CLAIMED]?: boolean };
  if (ev[CLAIMED]) return false;
  ev[CLAIMED] = true;
  return true;
}

/** Drop-target bindings for a single element (enter/leave depth-tracked). */
export function useDropTarget(onFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onFiles);
  cb.current = onFiles;

  const onDragEnter = (e: ReactDragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current++;
    setOver(true);
  };
  const onDragOver = (e: ReactDragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: ReactDragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };
  // No stopPropagation: the window listener must still see this drop so it can
  // lower the catch overlay. It skips the import itself on `defaultPrevented`.
  const onDrop = (e: ReactDragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    cb.current(Array.from(e.dataTransfer.files));
  };
  return { over, bind: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

/** True while OS files are dragged anywhere over the window; drops anywhere import. */
export function useWindowDrag(onFiles: (files: File[]) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onFiles);
  cb.current = onFiles;
  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      depth.current = 0;
      setDragging(false);
      if (!hasFiles(e) || e.defaultPrevented || !claim(e)) return;
      e.preventDefault();
      cb.current(Array.from(e.dataTransfer?.files ?? []));
    };
    // A drag that ends outside the window can skip its last dragleave, so
    // dragend is the backstop that stops the overlay hanging around.
    const end = () => {
      depth.current = 0;
      setDragging(false);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("dragend", end);
    };
  }, []);
  return dragging;
}

/** ⌘V with files on the clipboard (outside inputs) imports them. */
export function usePasteImport(onFiles: (files: File[]) => void) {
  const cb = useRef(onFiles);
  cb.current = onFiles;
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (/INPUT|TEXTAREA/.test(target.tagName) || target.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length || !claim(e)) return;
      e.preventDefault();
      cb.current(files);
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, []);
}

/** Hidden multi-file input; `open()` triggers the OS picker. */
export function useFilePicker(onFiles: (files: File[]) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const open = useCallback(() => ref.current?.click(), []);
  const input = (
    <input
      ref={ref}
      type="file"
      multiple
      accept={ACCEPT}
      aria-label="미디어 파일 가져오기"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length) onFiles(files);
        e.target.value = "";
      }}
    />
  );
  return { open, input };
}
