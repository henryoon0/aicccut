/**
 * Right column: the inspector at 320px, collapsing to a 48px rail. Width is
 * sprung; the two bodies cross-fade so the collapse reads as one gesture.
 * The panel body itself belongs to the inspector area.
 */
import { AnimatePresence, motion } from "framer-motion";
import { PanelRightOpen } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { spring } from "#/lib/springs.ts";
import { useActions, useEditor } from "#/editor/core";
import { Inspector } from "#/editor/inspector";
import { RAIL_W } from "./rail";

export const INSPECTOR_W = 320;

export function InspectorColumn() {
  const actions = useActions();
  const open = useEditor((s) => s.uiPanels.inspector);
  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? INSPECTOR_W : RAIL_W }}
      transition={spring.moderate}
      aria-label="Inspector"
      className="relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-surface-2"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <motion.div
            key="full"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={spring.fast}
            className="flex min-h-0 flex-1 flex-col"
            style={{ width: INSPECTOR_W }}
          >
            <div className="flex h-9 shrink-0 items-center border-b border-border px-3 text-[12px] font-medium">Inspector</div>
            <div className="flex min-h-0 w-full flex-1 flex-col bg-surface-3">
              <Inspector />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="rail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.fast}
            className="flex flex-col items-center gap-1 py-2"
            style={{ width: RAIL_W }}
          >
            <Tooltip content="Inspector (I)" side="left">
              <Button variant="ghost" size="icon-compact" aria-label="Open inspector" onClick={() => actions.setUi({ inspector: true })}>
                <PanelRightOpen />
              </Button>
            </Tooltip>
            <span className="mt-2 text-[10px] tracking-wider text-muted-foreground uppercase [writing-mode:vertical-rl]">Inspector</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
