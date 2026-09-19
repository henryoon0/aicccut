"use client";

/**
 * Helpers shared only inside the command-palette step: the editor state the
 * commands act on, the confirmation toast, key chips, and the ⌘K / editor
 * hotkey listeners. The editor frame itself lives in ./frame.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  Check,
  FilePlus,
  FolderOpen,
  Frame,
  Magnet,
  Maximize2,
  Play,
  Redo2,
  Scissors,
  Share2,
  SkipBack,
  Sparkles,
  StepBack,
  StepForward,
  Trash2,
  Type,
  Undo2,
  Waves,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { Kbd, KbdGroup } from "#/components/ui/kbd.tsx";
import {
  formatShortcut,
  matchesShortcut,
  parseShortcut,
  useIsMac,
  type CommandMenuItemData,
} from "#/components/ui/command-menu.tsx";
import { Elevated } from "#/lib/elevated.tsx";
import { spring } from "#/lib/springs.ts";
import { cn } from "#/lib/utils.ts";
import { CLIPS, COMMANDS, PROJECTS, PROJECT_DURATION, timecode } from "#/prototypes/mock";

export const PROJECT = PROJECTS[0];
export type Command = (typeof COMMANDS)[number];
export const GROUP_ORDER = ["Edit", "Playback", "Insert", "File", "View"] as const;

export const COMMAND_ICONS: Record<string, LucideIcon> = {
  split: Scissors,
  delete: Trash2,
  ripple: Waves,
  undo: Undo2,
  redo: Redo2,
  play: Play,
  "prev-frame": StepBack,
  "next-frame": StepForward,
  "goto-start": SkipBack,
  "add-text": Type,
  "add-effect": Sparkles,
  import: FolderOpen,
  export: Share2,
  new: FilePlus,
  "zoom-in": ZoomIn,
  "zoom-out": ZoomOut,
  fit: Maximize2,
  "toggle-snap": Magnet,
  "safe-areas": Frame,
  bookmark: Bookmark,
};

/** One line on what the command does, for teaching surfaces. */
export const COMMAND_HINTS: Record<string, string> = {
  split: "Cut the clip under the playhead in two",
  delete: "Remove the selected clips",
  ripple: "Closing gaps when you delete or trim",
  undo: "Step back one change",
  redo: "Step forward one change",
  play: "Start or stop playback",
  "prev-frame": "Nudge the playhead one frame back",
  "next-frame": "Nudge the playhead one frame forward",
  "goto-start": "Jump the playhead to 00:00",
  "add-text": "Drop a text layer at the playhead",
  "add-effect": "Browse effects for the selection",
  import: "Bring video, audio or images into the library",
  export: "Render the project to a file",
  new: "Start a fresh project",
  "zoom-in": "Show less time, more detail",
  "zoom-out": "Show more of the timeline",
  fit: "Zoom so the whole project is visible",
  "toggle-snap": "Snap clips to edges and the playhead",
  "safe-areas": "Show title and action guides on the canvas",
  bookmark: "Mark this moment in the ruler",
};

const KEYWORDS: Record<string, string[]> = {
  split: ["cut", "razor", "blade"],
  delete: ["remove", "trash"],
  ripple: ["gap", "close"],
  play: ["pause", "stop", "space"],
  "add-text": ["title", "caption"],
  "add-effect": ["filter", "blur"],
  import: ["open", "media", "file"],
  export: ["render", "save", "mp4"],
  fit: ["zoom", "all"],
  "toggle-snap": ["magnet"],
  "safe-areas": ["guides", "title safe"],
  bookmark: ["marker"],
};

/** The mock commands as fluid CommandMenu rows. Module constant: stable. */
export const COMMAND_ITEMS: CommandMenuItemData[] = COMMANDS.map((c) => ({
  value: c.id,
  label: c.label,
  shortcut: c.shortcut,
  group: c.group,
  icon: COMMAND_ICONS[c.id],
  keywords: KEYWORDS[c.id],
}));

export const COMMAND_BY_ID: Record<string, Command> = Object.fromEntries(
  COMMANDS.map((c) => [c.id, c])
);

/* ─────────────────────── Editor state ─────────────────────── */

interface Snapshot {
  cuts: { trackId: string; time: number }[];
  deleted: string[];
  texts: { id: string; start: number; label: string }[];
  bookmarks: number[];
}

export interface EditorState extends Snapshot {
  time: number;
  playing: boolean;
  selectedClipId: string | null;
  snapping: boolean;
  ripple: boolean;
  safeAreas: boolean;
  zoom: number;
  history: { label: string; before: Snapshot }[];
  redo: { label: string; after: Snapshot }[];
}

const FPS = PROJECT.fps;

function snapshot(s: EditorState): Snapshot {
  return { cuts: s.cuts, deleted: s.deleted, texts: s.texts, bookmarks: s.bookmarks };
}

export interface Editor {
  state: EditorState;
  /** Runs a command and returns the confirmation line. */
  run: (id: string) => string;
  selectClip: (id: string | null) => void;
  seek: (t: number) => void;
}

export function useEditor(initial?: Partial<EditorState>): Editor {
  const [state, setState] = useState<EditorState>({
    time: 12.04,
    playing: false,
    selectedClipId: null,
    snapping: true,
    ripple: false,
    safeAreas: false,
    zoom: 1,
    cuts: [],
    deleted: [],
    texts: [],
    bookmarks: [40],
    history: [],
    redo: [],
    ...initial,
  });
  const ref = useRef(state);
  ref.current = state;

  // Playback clock.
  useEffect(() => {
    if (!state.playing) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      if (last !== null) {
        const dt = (now - last) / 1000;
        setState((s) => {
          const next = s.time + dt;
          if (next >= PROJECT_DURATION) return { ...s, time: PROJECT_DURATION, playing: false };
          return { ...s, time: next };
        });
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.playing]);

  const run = useCallback((id: string): string => {
    const s = ref.current;
    const tc = timecode(s.time, FPS);
    const commit = (label: string, next: Partial<Snapshot>) => {
      setState((cur) => ({
        ...cur,
        ...next,
        history: [...cur.history, { label, before: snapshot(cur) }],
        redo: [],
      }));
    };
    switch (id) {
      case "split": {
        const clip =
          (s.selectedClipId && CLIPS.find((c) => c.id === s.selectedClipId)) ||
          CLIPS.find(
            (c) =>
              !s.deleted.includes(c.id) &&
              c.trackId === "t-v1" &&
              s.time >= c.start &&
              s.time <= c.start + c.duration
          );
        if (!clip || s.time < clip.start || s.time > clip.start + clip.duration)
          return "Nothing under the playhead";
        commit("Split", { cuts: [...s.cuts, { trackId: clip.trackId, time: s.time }] });
        return `Split at ${tc}`;
      }
      case "delete": {
        const clip = CLIPS.find((c) => c.id === s.selectedClipId);
        if (!clip) return "Nothing selected";
        commit("Delete", { deleted: [...s.deleted, clip.id] });
        setState((cur) => ({ ...cur, selectedClipId: null }));
        return `Deleted ${clip.label}${s.ripple ? " · gap closed" : ""}`;
      }
      case "ripple":
        setState((cur) => ({ ...cur, ripple: !cur.ripple }));
        return `Ripple editing ${s.ripple ? "off" : "on"}`;
      case "undo": {
        const last = s.history[s.history.length - 1];
        if (!last) return "Nothing to undo";
        setState((cur) => ({
          ...cur,
          ...last.before,
          history: cur.history.slice(0, -1),
          redo: [...cur.redo, { label: last.label, after: snapshot(cur) }],
        }));
        return `Undid ${last.label}`;
      }
      case "redo": {
        const next = s.redo[s.redo.length - 1];
        if (!next) return "Nothing to redo";
        setState((cur) => ({
          ...cur,
          ...next.after,
          redo: cur.redo.slice(0, -1),
          history: [...cur.history, { label: next.label, before: snapshot(cur) }],
        }));
        return `Redid ${next.label}`;
      }
      case "play":
        setState((cur) => ({ ...cur, playing: !cur.playing }));
        return s.playing ? `Paused at ${tc}` : "Playing";
      case "prev-frame": {
        const t = Math.max(0, s.time - 1 / FPS);
        setState((cur) => ({ ...cur, time: t, playing: false }));
        return `Playhead ${timecode(t, FPS)}`;
      }
      case "next-frame": {
        const t = Math.min(PROJECT_DURATION, s.time + 1 / FPS);
        setState((cur) => ({ ...cur, time: t, playing: false }));
        return `Playhead ${timecode(t, FPS)}`;
      }
      case "goto-start":
        setState((cur) => ({ ...cur, time: 0, playing: false }));
        return "Playhead 00:00:00.00";
      case "add-text":
        commit("Add text", {
          texts: [...s.texts, { id: `tx${s.texts.length + 1}`, start: s.time, label: "New text" }],
        });
        return `Text added at ${tc}`;
      case "add-effect":
        return "Effect browser opened";
      case "import":
        return "Import dialog opened";
      case "export":
        return "Export dialog opened";
      case "new":
        return "New project dialog opened";
      case "zoom-in": {
        const z = Math.min(4, s.zoom * 1.25);
        setState((cur) => ({ ...cur, zoom: z }));
        return `Timeline zoom ${Math.round(z * 100)}%`;
      }
      case "zoom-out": {
        const z = Math.max(1, s.zoom / 1.25);
        setState((cur) => ({ ...cur, zoom: z }));
        return `Timeline zoom ${Math.round(z * 100)}%`;
      }
      case "fit":
        setState((cur) => ({ ...cur, zoom: 1 }));
        return "Timeline fits the window";
      case "toggle-snap":
        setState((cur) => ({ ...cur, snapping: !cur.snapping }));
        return `Snapping ${s.snapping ? "off" : "on"}`;
      case "safe-areas":
        setState((cur) => ({ ...cur, safeAreas: !cur.safeAreas }));
        return `Safe areas ${s.safeAreas ? "hidden" : "shown"}`;
      case "bookmark":
        commit("Add bookmark", { bookmarks: [...s.bookmarks, s.time] });
        return `Bookmark at ${tc}`;
      default:
        return "Done";
    }
  }, []);

  const selectClip = useCallback((id: string | null) => {
    setState((cur) => ({ ...cur, selectedClipId: id }));
  }, []);
  const seek = useCallback((t: number) => {
    setState((cur) => ({ ...cur, time: Math.min(PROJECT_DURATION, Math.max(0, t)), playing: false }));
  }, []);

  return { state, run, selectClip, seek };
}

/* ─────────────────────── Hotkeys ─────────────────────── */

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
}

/** ⌘K / Ctrl+K toggles; Escape closes (unless a field already used it). */
export function usePaletteToggle(open: boolean, setOpen: (open: boolean) => void, onEscape?: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      if (e.key === "Escape" && !e.defaultPrevented) {
        if (onEscape) onEscape();
        else if (open) setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, onEscape]);
}

// The harness picker owns ← → and R outside fields, so those three
// commands run from the palette only.
const FRAME_SKIP = new Set(["prev-frame", "next-frame", "ripple"]);
const PARSED = COMMANDS.map((c) => ({ id: c.id, parsed: parseShortcut(c.shortcut) }));

/** The editor's own shortcuts, live while the palette is closed. */
export function useEditorShortcuts(enabled: boolean, onRun: (id: string) => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || isEditable(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") return;
      for (const { id, parsed } of PARSED) {
        if (FRAME_SKIP.has(id)) continue;
        if (matchesShortcut(e, parsed)) {
          e.preventDefault();
          onRun(id);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onRun]);
}

/* ─────────────────────── Key chips ─────────────────────── */

export function Keys({
  shortcut,
  size = "sm",
  className,
  capClassName,
}: {
  shortcut: string;
  size?: "sm" | "md";
  className?: string;
  capClassName?: string;
}) {
  const mac = useIsMac();
  const caps = formatShortcut(shortcut, mac);
  return (
    <KbdGroup className={cn("gap-0.5", className)}>
      {caps.map((cap, i) => (
        <Kbd
          key={i}
          className={cn(
            size === "md" && "h-6 min-w-6 px-1.5 text-[11px]",
            "bg-surface-5 text-foreground/80",
            capClassName
          )}
        >
          {cap}
        </Kbd>
      ))}
    </KbdGroup>
  );
}

/* ─────────────────────── Toast ─────────────────────── */

export interface ToastData {
  id: number;
  message: string;
  tip?: ReactNode;
}

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const show = useCallback((message: string, tip?: ReactNode) => {
    setToast({ id: Date.now(), message, tip });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.tip ? 4200 : 2400);
    return () => clearTimeout(id);
  }, [toast]);
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastData | null }) {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-[60]">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, transition: spring.moderate.exit }}
            transition={spring.moderate}
            style={{ transformOrigin: "bottom right" }}
          >
            <Elevated offset={3} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px]">
              <span className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
                <Check size={11} strokeWidth={2.5} />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-foreground">{toast.message}</span>
                {toast.tip && <span className="text-muted-foreground">{toast.tip}</span>}
              </span>
            </Elevated>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
