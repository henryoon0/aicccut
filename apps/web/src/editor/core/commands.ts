/**
 * Command registry: one table drives the palette, the shortcut cheatsheet
 * and the global key listener. Commands receive a `CommandContext` and may
 * return a short status string for a toast.
 */
import { useEffect, useMemo } from "react";
import type { Actions } from "./actions";
import { useEditorContext } from "./context";
import { documentDuration } from "./document";
import { timecode } from "./seed";
import { hasModifier, isEditableTarget, matchesShortcut, parseShortcut, shortcutSpecificity } from "./shortcuts";
import type { EditorStore, UiState } from "./store";
import type { TimeStore } from "./time-store";
import type { Transport } from "./transport";

export type CommandGroup = "Edit" | "Playback" | "Insert" | "File" | "View";
export const GROUP_ORDER: CommandGroup[] = ["Edit", "Playback", "Insert", "File", "View"];

/** Small facade over the `uiPanels` slice for commands. */
export interface UiApi {
  get(): UiState;
  set(patch: Partial<UiState>): void;
  toggle(key: Parameters<Actions["toggleUi"]>[0]): void;
  openDialog(dialog: NonNullable<UiState["dialog"]>): void;
  closeDialog(): void;
}

export interface CommandContext {
  store: EditorStore;
  actions: Actions;
  time: TimeStore;
  transport: Transport;
  ui: UiApi;
}

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  /** Primary shortcut, e.g. "Mod+Z", "S", "Space", "ArrowLeft". */
  shortcut?: string;
  /** Extra combos that also trigger the command (not shown in menus). */
  altShortcuts?: string[];
  keywords?: string[];
  /** Runs the command; an optional return string is a toast message. */
  run(ctx: CommandContext): string | void;
  enabled?(ctx: CommandContext): boolean;
}

/** Timeline zoom presets in px/s. */
export const ZOOM_PRESETS = [
  { id: "zoom-overview", label: "Zoom: overview", pps: 5, shortcut: "Alt+1" },
  { id: "zoom-normal", label: "Zoom: normal", pps: 20, shortcut: "Alt+2" },
  { id: "zoom-detail", label: "Zoom: detail", pps: 80, shortcut: "Alt+3" },
  { id: "zoom-frames", label: "Zoom: frames", pps: 300, shortcut: "Alt+4" },
];

const hasSelection = (ctx: CommandContext) => ctx.store.getState().selection.clipIds.length > 0;
const tc = (ctx: CommandContext) => timecode(ctx.time.get(), ctx.store.getState().doc.project.fps);
const primary = (ctx: CommandContext) => {
  const ids = ctx.store.getState().selection.clipIds;
  return ids[ids.length - 1];
};

export const COMMAND_LIST: Command[] = [
  // ── Edit ──
  { id: "split", label: "Split clip at playhead", shortcut: "S", group: "Edit", keywords: ["cut", "razor", "blade"],
    run: (ctx) => (ctx.actions.splitClips(undefined, ctx.time.get()).length ? `Split at ${tc(ctx)}` : "Nothing under the playhead") },
  { id: "delete", label: "Delete selection", shortcut: "Backspace", altShortcuts: ["Delete"], group: "Edit", keywords: ["remove", "trash"], enabled: hasSelection,
    run: (ctx) => { ctx.actions.deleteClips(); return ctx.store.getState().ripple ? "Deleted · gap closed" : "Deleted"; } },
  { id: "ripple-delete", label: "Ripple delete selection", shortcut: "Shift+Backspace", altShortcuts: ["Shift+Delete"], group: "Edit", keywords: ["close gap"], enabled: hasSelection,
    run: (ctx) => { ctx.actions.deleteClips(undefined, true); return "Deleted · gap closed"; } },
  { id: "ripple", label: "Toggle ripple editing", shortcut: "R", group: "Edit", keywords: ["gap", "close"],
    run: (ctx) => { ctx.actions.toggleRipple(); return `Ripple editing ${ctx.store.getState().ripple ? "on" : "off"}`; } },
  { id: "undo", label: "Undo", shortcut: "Mod+Z", group: "Edit", enabled: (ctx) => ctx.store.canUndo(),
    run: (ctx) => { ctx.actions.undo(); return "Undo"; } },
  { id: "redo", label: "Redo", shortcut: "Mod+Shift+Z", altShortcuts: ["Mod+Y"], group: "Edit", enabled: (ctx) => ctx.store.canRedo(),
    run: (ctx) => { ctx.actions.redo(); return "Redo"; } },
  { id: "duplicate", label: "Duplicate clip", shortcut: "Mod+D", group: "Edit", keywords: ["copy"], enabled: hasSelection,
    run: (ctx) => { ctx.actions.duplicateClip(); return "Duplicated"; } },
  { id: "mute-clip", label: "Mute / unmute clip", shortcut: "Shift+M", group: "Edit", keywords: ["silence", "audio"], enabled: hasSelection,
    run: (ctx) => { ctx.actions.toggleClipsMuted(); return "Toggled mute"; } },
  { id: "trim-start-to-playhead", label: "Trim start to playhead", shortcut: "[", group: "Edit", keywords: ["trim", "in"], enabled: hasSelection,
    run: (ctx) => { const id = primary(ctx); if (id) ctx.actions.trimToTime(id, "start", ctx.time.get()); return `Start trimmed to ${tc(ctx)}`; } },
  { id: "trim-end-to-playhead", label: "Trim end to playhead", shortcut: "]", group: "Edit", keywords: ["trim", "out"], enabled: hasSelection,
    run: (ctx) => { const id = primary(ctx); if (id) ctx.actions.trimToTime(id, "end", ctx.time.get()); return `End trimmed to ${tc(ctx)}`; } },
  { id: "select-all", label: "Select all clips", shortcut: "Mod+A", group: "Edit", run: (ctx) => { ctx.actions.selectAll(); } },
  { id: "deselect", label: "Clear selection", shortcut: "Escape", group: "Edit",
    run: (ctx) => { if (ctx.ui.get().dialog) ctx.ui.closeDialog(); else ctx.actions.clearSelection(); } },

  // ── Playback ──
  { id: "play", label: "Play / Pause", shortcut: "Space", group: "Playback", keywords: ["pause", "stop"],
    run: (ctx) => { ctx.transport.toggle(); return ctx.transport.getState().playing ? "Playing" : `Paused at ${tc(ctx)}`; } },
  { id: "prev-frame", label: "Previous frame", shortcut: "ArrowLeft", group: "Playback", run: (ctx) => { ctx.transport.stepFrames(-1); } },
  { id: "next-frame", label: "Next frame", shortcut: "ArrowRight", group: "Playback", run: (ctx) => { ctx.transport.stepFrames(1); } },
  { id: "prev-10-frames", label: "Back 10 frames", shortcut: "Shift+ArrowLeft", group: "Playback", run: (ctx) => { ctx.transport.stepFrames(-10); } },
  { id: "next-10-frames", label: "Forward 10 frames", shortcut: "Shift+ArrowRight", group: "Playback", run: (ctx) => { ctx.transport.stepFrames(10); } },
  { id: "goto-start", label: "Go to start", shortcut: "Home", group: "Playback", run: (ctx) => { ctx.transport.goToStart(); } },
  { id: "goto-end", label: "Go to end", shortcut: "End", group: "Playback", run: (ctx) => { ctx.transport.goToEnd(); } },
  { id: "shuttle-back", label: "Shuttle backwards (J)", shortcut: "J", group: "Playback", keywords: ["jkl", "reverse"],
    run: (ctx) => { ctx.transport.shuttle(-1); return `${ctx.transport.getState().rate}×`; } },
  { id: "shuttle-stop", label: "Stop (K)", shortcut: "K", group: "Playback", keywords: ["jkl"], run: (ctx) => { ctx.transport.pause(); } },
  { id: "shuttle-forward", label: "Shuttle forwards (L)", shortcut: "L", group: "Playback", keywords: ["jkl", "fast"],
    run: (ctx) => { ctx.transport.shuttle(1); return `${ctx.transport.getState().rate}×`; } },
  { id: "toggle-loop", label: "Toggle loop playback", shortcut: "Alt+L", group: "Playback",
    run: (ctx) => { ctx.transport.toggleLoop(); return `Loop ${ctx.transport.getState().loop ? "on" : "off"}`; } },
  { id: "set-in", label: "Set in point", shortcut: "Shift+I", group: "Playback", keywords: ["range", "mark"],
    run: (ctx) => { ctx.transport.setIn(ctx.time.get()); return `In ${tc(ctx)}`; } },
  { id: "set-out", label: "Set out point", shortcut: "Shift+O", group: "Playback", keywords: ["range", "mark"],
    run: (ctx) => { ctx.transport.setOut(ctx.time.get()); return `Out ${tc(ctx)}`; } },
  { id: "clear-in-out", label: "Clear in / out points", shortcut: "Alt+X", group: "Playback", run: (ctx) => { ctx.transport.clearInOut(); } },

  // ── Insert ──
  { id: "add-text", label: "Add text", shortcut: "T", group: "Insert", keywords: ["title", "caption"],
    run: (ctx) => { ctx.actions.addTextClip(ctx.time.get()); return `Text added at ${tc(ctx)}`; } },
  { id: "add-effect", label: "Add effect…", shortcut: "E", group: "Insert", keywords: ["filter", "blur"], enabled: hasSelection,
    run: (ctx) => { ctx.ui.openDialog("effects"); } },
  { id: "bookmark", label: "Add bookmark", shortcut: "B", group: "Insert", keywords: ["marker"],
    run: (ctx) => { ctx.actions.addBookmark(ctx.time.get()); return `Bookmark at ${tc(ctx)}`; } },

  // ── File ──
  { id: "import", label: "Import media…", shortcut: "Mod+I", group: "File", keywords: ["open", "media", "file"], run: (ctx) => { ctx.ui.openDialog("import"); } },
  { id: "export", label: "Export…", shortcut: "Mod+E", group: "File", keywords: ["render", "save", "mp4"], run: (ctx) => { ctx.ui.openDialog("export"); } },
  { id: "new", label: "New project", shortcut: "Mod+N", group: "File", run: (ctx) => { ctx.ui.openDialog("new-project"); } },

  // ── View ──
  { id: "zoom-in", label: "Zoom timeline in", shortcut: "=", altShortcuts: ["Mod+="], group: "View", run: (ctx) => { ctx.actions.zoomBy(1.25); } },
  { id: "zoom-out", label: "Zoom timeline out", shortcut: "-", altShortcuts: ["Mod+-"], group: "View", run: (ctx) => { ctx.actions.zoomBy(1 / 1.25); } },
  { id: "fit", label: "Fit timeline to window", shortcut: "Shift+Z", group: "View", keywords: ["zoom", "all"],
    run: (ctx) => { ctx.actions.zoomToFit(); return "Timeline fits the window"; } },
  ...ZOOM_PRESETS.map<Command>((z) => ({ id: z.id, label: z.label, shortcut: z.shortcut, group: "View", keywords: ["zoom"], run: (ctx) => { ctx.actions.setZoomPps(z.pps); } })),
  { id: "toggle-snap", label: "Toggle snapping", shortcut: "N", group: "View", keywords: ["magnet"],
    run: (ctx) => { ctx.actions.toggleSnapping(); return `Snapping ${ctx.store.getState().snapping ? "on" : "off"}`; } },
  { id: "safe-areas", label: "Toggle safe areas", shortcut: "Mod+'", group: "View", keywords: ["guides", "title safe"],
    run: (ctx) => { ctx.ui.toggle("safeAreas"); return `Safe areas ${ctx.ui.get().safeAreas ? "shown" : "hidden"}`; } },
  { id: "toggle-grid", label: "Toggle grid", shortcut: "Mod+;", group: "View", run: (ctx) => { ctx.ui.toggle("grid"); } },
  { id: "toggle-media-panel", label: "Toggle media panel", shortcut: "M", group: "View", keywords: ["library", "assets"], run: (ctx) => { ctx.ui.toggle("mediaPanel"); } },
  { id: "toggle-inspector", label: "Toggle inspector", shortcut: "I", group: "View", keywords: ["properties"], run: (ctx) => { ctx.ui.toggle("inspector"); } },
  { id: "open-palette", label: "Command palette", shortcut: "Mod+K", group: "View", keywords: ["search", "commands"], run: (ctx) => { ctx.ui.set({ palette: true }); } },
  { id: "open-shortcuts", label: "Keyboard shortcuts", shortcut: "?", group: "View", keywords: ["help", "keys"], run: (ctx) => { ctx.ui.toggle("cheatsheet"); } },
];

export const COMMANDS_BY_ID: Record<string, Command> = Object.fromEntries(COMMAND_LIST.map((c) => [c.id, c]));

/** Commands grouped in `GROUP_ORDER`. */
export function commandsByGroup(list: Command[] = COMMAND_LIST): { group: CommandGroup; commands: Command[] }[] {
  return GROUP_ORDER.map((group) => ({ group, commands: list.filter((c) => c.group === group) })).filter((g) => g.commands.length);
}

/** Run a command by id when it exists and is enabled; returns its message. */
export function runCommand(id: string, ctx: CommandContext): string | void {
  const cmd = COMMANDS_BY_ID[id];
  if (!cmd || (cmd.enabled && !cmd.enabled(ctx))) return;
  return cmd.run(ctx);
}

/** Build a CommandContext from the three editor primitives. */
export function createCommandContext(store: EditorStore, time: TimeStore, transport: Transport): CommandContext {
  const a = store.actions;
  return {
    store, actions: a, time, transport,
    ui: { get: () => store.getState().uiPanels, set: a.setUi, toggle: a.toggleUi, openDialog: a.openDialog, closeDialog: a.closeDialog },
  };
}

/** CommandContext for the current EditorProvider (memoised). */
export function useCommandContext(): CommandContext {
  const { store, time, transport } = useEditorContext();
  return useMemo(() => createCommandContext(store, time, transport), [store, time, transport]);
}

interface Bound {
  cmd: Command;
  parsed: ReturnType<typeof parseShortcut>;
  specificity: number;
}

function bind(list: Command[]): Bound[] {
  const out: Bound[] = [];
  for (const cmd of list) {
    for (const s of [cmd.shortcut, ...(cmd.altShortcuts ?? [])]) {
      if (!s) continue;
      const parsed = parseShortcut(s);
      out.push({ cmd, parsed, specificity: shortcutSpecificity(parsed) });
    }
  }
  return out.sort((a, b) => b.specificity - a.specificity);
}

/** The command a keydown triggers (most specific match wins), or undefined. */
export function commandForKey(e: Parameters<typeof matchesShortcut>[0], list: Command[] = COMMAND_LIST): Command | undefined {
  return bind(list).find((b) => matchesShortcut(e, b.parsed))?.cmd;
}

/**
 * One window keydown listener that runs matching commands. Skipped while
 * typing in a field (except modifier combos like Mod+Z are left to the
 * browser too) and while the palette is open. `onMessage` receives toast text.
 */
export function useGlobalShortcuts(ctx: CommandContext, opts?: { commands?: Command[]; onMessage?: (msg: string) => void; enabled?: boolean }): void {
  const list = opts?.commands ?? COMMAND_LIST;
  const onMessage = opts?.onMessage;
  const enabled = opts?.enabled ?? true;
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const bound = bind(list);
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || isEditableTarget(e.target)) return;
      if (ctx.ui.get().palette) return;
      const hit = bound.find((b) => matchesShortcut(e, b.parsed));
      if (!hit) return;
      if (hit.cmd.enabled && !hit.cmd.enabled(ctx)) {
        if (!hasModifier(hit.parsed)) e.preventDefault();
        return;
      }
      e.preventDefault();
      const msg = hit.cmd.run(ctx);
      if (msg && onMessage) onMessage(msg);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx, list, onMessage, enabled]);
}

/** Timeline end for "go to end" style UI; re-exported here so palettes need only this module. */
export const durationOf = (ctx: CommandContext) => documentDuration(ctx.store.getState().doc);
