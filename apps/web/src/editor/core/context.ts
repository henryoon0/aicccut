/**
 * React context wiring for the editor. Only types are imported from the
 * other core modules so there is no runtime import cycle.
 */
import { createContext, useContext } from "react";
import type { EditorStore } from "./store";
import type { TimeStore } from "./time-store";
import type { Transport } from "./transport";

export interface EditorContextValue {
  store: EditorStore;
  time: TimeStore;
  transport: Transport;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

/** The editor context; throws when used outside `EditorProvider`. */
export function useEditorContext(): EditorContextValue {
  const v = useContext(EditorContext);
  if (!v) throw new Error("useEditorContext must be used inside <EditorProvider>");
  return v;
}
