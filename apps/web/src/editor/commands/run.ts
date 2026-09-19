/**
 * Running a command from a UI surface: core does the work, this adds the two
 * things a surface owes the user afterwards — a confirmation toast built from
 * the command and the playhead, and a note in the recent list.
 *
 * The recent list lives in localStorage so the palette can lead with it on a
 * cold start. Reads and writes are guarded: private windows throw.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { COMMANDS_BY_ID, runCommand, timecode, useCommandContext, type Command, type CommandContext } from "#/editor/core";

export const RECENT_KEY = "opencut.commands.recent";
export const RECENT_MAX = 6;

/** Recently run command ids, newest first. Empty on the server. */
export function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v in COMMANDS_BY_ID)
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** Move `id` to the front of the recent list and persist it. */
export function pushRecent(id: string): string[] {
  const next = [id, ...loadRecent().filter((v) => v !== id)].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the list is a convenience, not state */
  }
  return next;
}

/** The confirmation shown after a command runs. */
export function commandToast(message: string): void {
  toast.success(message, { duration: 2400 });
}

/** Whether a command may run right now. */
export function isEnabled(cmd: Command, ctx: CommandContext): boolean {
  return cmd.enabled ? cmd.enabled(ctx) : true;
}

/** Fallback confirmation for commands that return nothing, e.g. "Next frame · 00:00:12.04". */
function fallbackMessage(cmd: Command, ctx: CommandContext): string {
  const { fps } = ctx.store.getState().doc.project;
  return `${cmd.label} · ${timecode(ctx.time.get(), fps)}`;
}

/**
 * Runs a command by id: skips it when disabled, records it as recent and
 * toasts the message core handed back (or one built from the command and the
 * playhead). Returns whether it ran, so a caller can decide what to close.
 */
export function useRunCommand(): (id: string) => boolean {
  const ctx = useCommandContext();
  return useCallback(
    (id: string) => {
      const cmd = COMMANDS_BY_ID[id];
      if (!cmd || !isEnabled(cmd, ctx)) return false;
      const message = runCommand(id, ctx);
      pushRecent(id);
      commandToast(typeof message === "string" && message !== "" ? message : fallbackMessage(cmd, ctx));
      return true;
    },
    [ctx],
  );
}
