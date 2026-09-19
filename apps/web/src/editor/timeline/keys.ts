/**
 * Shortcut captions. Platform detection happens after mount so the server
 * render and the first client render agree.
 */
import { useEffect, useState } from "react";
import { formatShortcut, isMacPlatform } from "#/editor/core";

export function useMac(): boolean {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(isMacPlatform()), []);
  return mac;
}

/** Key caps for a core shortcut string, e.g. "Mod+D" → ["⌘", "D"]. */
export function useKeyCaps(): (shortcut: string) => string[] {
  const mac = useMac();
  return (shortcut: string) => formatShortcut(shortcut, mac);
}

/** One-line caption for menus, e.g. "⌘D" or "Ctrl+D". */
export function useShortcutText(): (shortcut: string) => string {
  const mac = useMac();
  return (shortcut: string) => formatShortcut(shortcut, mac).join(mac ? "" : "+");
}
