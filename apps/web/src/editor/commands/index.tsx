/**
 * Commands area — the two surfaces that teach and run the command registry.
 *
 * - `CommandPalette` (⌘K): run anything by name, recents first.
 * - `ShortcutsSheet` (?): the cheat sheet, with a drawn keyboard.
 *
 * Both read `uiPanels.palette` / `uiPanels.cheatsheet` and close through
 * `actions.setUi`. The global key listener lives in core; these only add the
 * keys their own fields own. `commandToast` is the confirmation the shell can
 * hand `useGlobalShortcuts` as `onMessage`, so a shortcut and a palette row
 * report the same way.
 */
export { CommandPalette } from "./palette";
export { ShortcutsSheet } from "./sheet";
export { commandToast, useRunCommand } from "./run";
