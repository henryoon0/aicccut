"use client";

/**
 * Stacked — two rows. Top: preview centred with the inspector beside it.
 * Bottom: one tabbed dock where Timeline / Media / Effects share the same
 * area. Fewer simultaneous panels, larger targets; built for a tablet or a
 * 13" laptop.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Film, ListVideo, Sparkles } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Tabs, TabsList, TabItem, TabPanel } from "#/components/ui/tabs.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "#/components/ui/resizable.tsx";
import { cn } from "#/lib/utils.ts";
import { spring } from "#/lib/springs.ts";
import { EFFECTS } from "#/prototypes/mock";
import { InspectorFields, MediaGrid, PreviewCanvas, Scrubber } from "./panels";
import { TimelineStrip, TopBar, TransportControls, useTransport, useTransportKeys } from "./shared";

export function Stacked() {
  const t = useTransport();
  useTransportKeys(t);
  const [dock, setDock] = useState("timeline");
  const [inspector, setInspector] = useState(true);
  const [selectedClip, setSelectedClip] = useState<string | null>("c2");

  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <TopBar
        center={
          <div className="flex items-center gap-3">
            <TransportControls t={t} />
          </div>
        }
        trailing={
          <Tooltip content={inspector ? "Hide inspector" : "Show inspector"} side="bottom">
            <Button
              variant="ghost"
              size="compact"
              active={inspector}
              onClick={() => setInspector((v) => !v)}
            >
              Inspector
            </Button>
          </Tooltip>
        }
      />
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="58" minSize="30">
          <div className="flex h-full min-h-0">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <PreviewCanvas t={t} className="p-6 [--pv-pad:3rem]" />
              <div className="flex h-12 shrink-0 items-center px-6">
                <Scrubber t={t} className="flex-1" />
              </div>
            </div>
            <AnimatePresence initial={false}>
              {inspector && (
                <motion.aside
                  key="inspector"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 300, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={spring.moderate}
                  className="shrink-0 overflow-hidden border-l border-border bg-surface-2"
                >
                  <div className="flex h-full min-h-0 flex-col" style={{ width: 300 }}>
                    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3 text-[13px] font-medium">
                      Inspector
                      <Button
                        variant="ghost"
                        size="icon-compact"
                        aria-label="Hide inspector"
                        onClick={() => setInspector(false)}
                      >
                        <ChevronRight />
                      </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <InspectorFields layout="grid" className="gap-4 p-4 text-[13px]" />
                    </div>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle className="hover:bg-ring/60 transition-colors" />
        <ResizablePanel defaultSize="42" minSize={160}>
          <Tabs value={dock} onValueChange={setDock} className="flex h-full min-h-0 flex-col bg-surface-2">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
              <TabsList>
                <TabItem value="timeline" label="Timeline" icon={ListVideo} />
                <TabItem value="media" label="Media" icon={Film} />
                <TabItem value="effects" label="Effects" icon={Sparkles} />
              </TabsList>
              <span className="text-[12px] text-muted-foreground">
                {dock === "timeline" ? "6 tracks · 12 clips" : dock === "media" ? "12 items" : `${EFFECTS.length} effects`}
              </span>
            </div>
            <TabPanel value="timeline" className="flex min-h-0 flex-1 flex-col">
              <TimelineStrip
                t={t}
                trackHeight={34}
                headerWidth={128}
                selectedClip={selectedClip}
                onClipSelect={setSelectedClip}
                className="flex-1 text-[12px]"
              />
            </TabPanel>
            <TabPanel value="media" className="flex min-h-0 flex-1 flex-col">
              <MediaGrid columns={4} className="[&_input]:h-9 [&_label]:h-9" />
            </TabPanel>
            <TabPanel value="effects" className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-4 gap-3">
                {EFFECTS.map((e, i) => (
                  <button
                    type="button"
                    key={e.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg p-2 text-left transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
                    )}
                  >
                    <div
                      className="aspect-video w-full rounded-md"
                      style={{
                        background: `linear-gradient(${120 + i * 30}deg, oklch(0.5 0.1 ${i * 45}), oklch(0.28 0.06 ${i * 45 + 40}))`,
                      }}
                    />
                    <span className="text-[13px] font-medium text-foreground">{e.name}</span>
                    <span className="text-[11px] text-muted-foreground">{e.description}</span>
                  </button>
                ))}
              </div>
            </TabPanel>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
