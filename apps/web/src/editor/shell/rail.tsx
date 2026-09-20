/**
 * Left icon rail and its flyout. Media / Text / Effects / Audio each open one
 * flyout at a time (`uiPanels.rail` + `uiPanels.mediaPanel`); the width is
 * sprung so the stage reflows in one motion.
 *
 * The shell owns the flyout's titled header and its close button, as Studio
 * does; the media and inspector areas supply the body below it and add no
 * title of their own.
 */
import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Film, Music, Sparkles, Type, X, type LucideIcon } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { cn } from "#/lib/utils.ts";
import { spring } from "#/lib/springs.ts";
import { useActions, useEditor, type RailTool } from "#/editor/core";
import { MediaPanel } from "#/editor/media";
import { EffectsPanel, TextPanel } from "#/editor/inspector";

export const RAIL_W = 48;
export const FLYOUT_W = 280;

/** The media area owns this component; the audio rail reuses it filtered. */
const MediaFlyout: ComponentType<{ filter?: "audio" }> = MediaPanel;

export const TOOLS: { id: RailTool; label: string; icon: LucideIcon; key: string }[] = [
  { id: "media", label: "미디어", icon: Film, key: "1" },
  { id: "text", label: "텍스트", icon: Type, key: "2" },
  { id: "effects", label: "효과", icon: Sparkles, key: "3" },
  { id: "audio", label: "오디오", icon: Music, key: "4" },
];

function RailButton({
  icon: Icon,
  label,
  shortcut,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={`${label} ${active ? "닫기" : "열기"} (${shortcut})`} side="right">
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "relative flex h-12 w-full flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground outline-none transition-colors duration-80 hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {active && (
          <motion.span
            layoutId="studio-rail-indicator"
            transition={spring.moderate}
            className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-foreground"
          />
        )}
        <Icon size={18} strokeWidth={1.75} />
        <span>{label}</span>
      </button>
    </Tooltip>
  );
}

/** The always-visible icon column. */
export function ToolRail() {
  const actions = useActions();
  // One primitive per selector: useSyncExternalStore compares snapshots with Object.is.
  const rail = useEditor((s) => s.uiPanels.rail);
  const open = useEditor((s) => s.uiPanels.mediaPanel);
  return (
    <nav aria-label="도구" className="flex shrink-0 flex-col border-r border-border bg-surface-2" style={{ width: RAIL_W }}>
      {TOOLS.map((t) => (
        <RailButton
          key={t.id}
          icon={t.icon}
          label={t.label}
          shortcut={t.key}
          active={open && rail === t.id}
          onClick={() =>
            open && rail === t.id ? actions.setUi({ mediaPanel: false }) : actions.setUi({ mediaPanel: true, rail: t.id })
          }
        />
      ))}
    </nav>
  );
}

function FlyoutBody({ tool }: { tool: RailTool }) {
  if (tool === "media") return <MediaFlyout />;
  if (tool === "audio") return <MediaFlyout filter="audio" />;
  if (tool === "text") return <TextPanel />;
  return <EffectsPanel />;
}

/** The one open panel next to the rail; width animates in and out. */
export function ToolFlyout() {
  const actions = useActions();
  // One primitive per selector: useSyncExternalStore compares snapshots with Object.is.
  const rail = useEditor((s) => s.uiPanels.rail);
  const open = useEditor((s) => s.uiPanels.mediaPanel);
  const tool = TOOLS.find((t) => t.id === rail);
  return (
    <AnimatePresence initial={false}>
      {open && tool && (
        <motion.aside
          key="flyout"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: FLYOUT_W, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={spring.moderate}
          aria-label={tool.label}
          className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface-3"
        >
          <div className="flex min-h-0 flex-col" style={{ width: FLYOUT_W }}>
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-[12px] font-medium">
              <tool.icon size={13} className="text-muted-foreground" />
              {tool.label}
              <Button
                variant="ghost"
                size="icon-compact"
                aria-label="패널 닫기"
                className="ml-auto"
                onClick={() => actions.setUi({ mediaPanel: false })}
              >
                <X />
              </Button>
            </div>
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <FlyoutBody tool={tool.id} />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
