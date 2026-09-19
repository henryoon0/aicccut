"use client";

/**
 * Studio — CapCut/Canva-style rails. A left icon rail (Media / Text / Effects /
 * Audio) opens one flyout at a time; the inspector on the right collapses to a
 * rail as well. Preview + timeline take everything in between. Rails toggle
 * with a spring under 300ms.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Film,
  Music,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "#/components/ui/resizable.tsx";
import { cn } from "#/lib/utils.ts";
import { spring } from "#/lib/springs.ts";
import { EFFECTS, FONTS } from "#/prototypes/mock";
import { InspectorFields, MediaGrid, PreviewCanvas, Scrubber } from "./panels";
import { TimelineStrip, TopBar, TransportControls, useTransport, useTransportKeys } from "./shared";

type Tool = "media" | "text" | "effects" | "audio";

const TOOLS: { id: Tool; label: string; icon: LucideIcon; key: string }[] = [
  { id: "media", label: "Media", icon: Film, key: "1" },
  { id: "text", label: "Text", icon: Type, key: "2" },
  { id: "effects", label: "Effects", icon: Sparkles, key: "3" },
  { id: "audio", label: "Audio", icon: Music, key: "4" },
];

const FLYOUT_W = 280;
const INSPECTOR_W = 260;
const RAIL_W = 48;

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
  shortcut,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label} side="right">
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "relative flex h-12 w-full flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground transition-colors duration-80 outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
          active && "text-foreground"
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

function FlyoutBody({ tool }: { tool: Tool }) {
  if (tool === "media") return <MediaGrid columns={2} />;
  if (tool === "audio") return <MediaGrid columns={1} filter="audio" />;
  if (tool === "text")
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        <Button variant="secondary" size="compact" className="w-full justify-start" leadingIcon={Type}>
          Add text
        </Button>
        <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Fonts</div>
        {FONTS.slice(0, 14).map((f) => (
          <button
            type="button"
            key={f}
            className="flex h-9 items-center rounded-md px-2 text-left text-[14px] transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
            style={{ fontFamily: `"${f}", sans-serif` }}
          >
            {f}
          </button>
        ))}
      </div>
    );
  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto p-2">
      {EFFECTS.map((e, i) => (
        <button
          type="button"
          key={e.id}
          className="flex flex-col gap-1 rounded-md p-1 text-left transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          <div
            className="aspect-video w-full rounded-[5px]"
            style={{ background: `linear-gradient(${120 + i * 30}deg, oklch(0.45 0.08 ${i * 45}), oklch(0.25 0.05 ${i * 45 + 40}))` }}
          />
          <span className="text-[11px] text-foreground">{e.name}</span>
          <span className="truncate text-[10px] text-muted-foreground">{e.description}</span>
        </button>
      ))}
    </div>
  );
}

export function Studio() {
  const t = useTransport();
  useTransportKeys(t);
  const [tool, setTool] = useState<Tool | null>("media");
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const activeTool = TOOLS.find((x) => x.id === tool);

  // 1–4 toggle the rail tools, I toggles the inspector.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const hit = TOOLS.find((x) => x.key === e.key);
      if (hit) setTool((cur) => (cur === hit.id ? null : hit.id));
      else if (e.key === "i") setInspectorOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <TopBar
        trailing={
          <Tooltip content={inspectorOpen ? "Hide inspector" : "Show inspector"} side="bottom">
            <Button
              variant="ghost"
              size="icon-compact"
              aria-label="Toggle inspector"
              onClick={() => setInspectorOpen((o) => !o)}
            >
              {inspectorOpen ? <PanelRightClose /> : <PanelRightOpen />}
            </Button>
          </Tooltip>
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* Left rail */}
        <nav className="flex shrink-0 flex-col border-r border-border bg-surface-1" style={{ width: RAIL_W }}>
          {TOOLS.map((x) => (
            <RailButton
              key={x.id}
              icon={x.icon}
              label={x.label}
              shortcut={x.key}
              active={tool === x.id}
              onClick={() => setTool((cur) => (cur === x.id ? null : x.id))}
            />
          ))}
        </nav>

        {/* Flyout */}
        <AnimatePresence initial={false}>
          {tool && activeTool && (
            <motion.aside
              key="flyout"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: FLYOUT_W, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={spring.moderate}
              className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface-2"
            >
              <div className="flex min-h-0 flex-1 flex-col" style={{ width: FLYOUT_W }}>
                <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-[12px] font-medium">
                  <activeTool.icon size={13} className="text-muted-foreground" />
                  {activeTool.label}
                  <Button
                    variant="ghost"
                    size="icon-compact"
                    aria-label="Close panel"
                    className="ml-auto"
                    onClick={() => setTool(null)}
                  >
                    <X />
                  </Button>
                </div>
                <FlyoutBody tool={tool} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Stage */}
        <ResizablePanelGroup orientation="vertical" className="min-h-0 min-w-0 flex-1">
          <ResizablePanel defaultSize="64" minSize="30">
            <div className="flex h-full min-h-0 flex-col">
              <PreviewCanvas t={t} className="p-6 [--pv-pad:3rem]" />
              <div className="flex h-11 shrink-0 items-center gap-3 px-4">
                <TransportControls t={t} />
                <Scrubber t={t} className="flex-1" />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle className="hover:bg-ring/60 transition-colors" />
          <ResizablePanel defaultSize="36" minSize={100}>
            <TimelineStrip t={t} className="h-full bg-surface-2" trackHeight={26} />
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Inspector: full panel or rail */}
        <motion.aside
          initial={false}
          animate={{ width: inspectorOpen ? INSPECTOR_W : RAIL_W }}
          transition={spring.moderate}
          className="relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-surface-2"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {inspectorOpen ? (
              <motion.div
                key="full"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={spring.fast}
                className="flex min-h-0 flex-1 flex-col"
                style={{ width: INSPECTOR_W }}
              >
                <div className="flex h-9 shrink-0 items-center border-b border-border px-3 text-[12px] font-medium">
                  Inspector
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <InspectorFields />
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
                <Tooltip content="Inspector" side="left">
                  <Button
                    variant="ghost"
                    size="icon-compact"
                    aria-label="Open inspector"
                    onClick={() => setInspectorOpen(true)}
                  >
                    <PanelRightOpen />
                  </Button>
                </Tooltip>
                <span className="mt-2 [writing-mode:vertical-rl] text-[10px] tracking-wider text-muted-foreground uppercase">
                  Inspector
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
      </div>
    </div>
  );
}
