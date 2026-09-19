"use client";

/**
 * Classic — Premiere-style four-pane frame. Media top-left, preview top-centre,
 * inspector top-right, timeline full-width below. Every split is a draggable
 * resizable handle; panels carry header rows with tabs.
 */

import { useState, type ReactNode } from "react";
import { Film, Layers, Magnet, Scissors, SlidersHorizontal, Sparkles, Type } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Tabs, TabsList, TabItem, TabPanel } from "#/components/ui/tabs.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "#/components/ui/resizable.tsx";
import { cn } from "#/lib/utils.ts";
import { EFFECTS } from "#/prototypes/mock";
import { InspectorFields, MediaGrid, PreviewCanvas, Scrubber } from "./panels";
import { PanelHeader, TimelineStrip, TopBar, TransportControls, useTransport, useTransportKeys } from "./shared";

function Pane({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface-2", className)}>
      {children}
    </div>
  );
}

export function Classic() {
  const t = useTransport();
  useTransportKeys(t);
  const [libTab, setLibTab] = useState("media");
  const [rightTab, setRightTab] = useState("inspector");
  const [selectedClip, setSelectedClip] = useState<string | null>("c2");
  const [snap, setSnap] = useState(true);

  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <TopBar />
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="62" minSize="30">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize="22" minSize={200} collapsible collapsedSize={0}>
              <Pane>
                <Tabs value={libTab} onValueChange={setLibTab} size="compact" className="flex min-h-0 flex-1 flex-col">
                  <div className="flex h-9 shrink-0 items-center border-b border-border px-1.5">
                    <TabsList>
                      <TabItem value="media" label="Media" icon={Film} />
                      <TabItem value="text" label="Text" icon={Type} />
                      <TabItem value="effects" label="Effects" icon={Sparkles} />
                    </TabsList>
                  </div>
                  <TabPanel value="media" className="flex min-h-0 flex-1 flex-col">
                    <MediaGrid columns={2} />
                  </TabPanel>
                  <TabPanel value="text" className="min-h-0 flex-1 overflow-y-auto p-2">
                    <div className="grid grid-cols-2 gap-2">
                      {["Title", "Subtitle", "Lower third", "Caption", "Quote", "Credits"].map((s) => (
                        <button
                          type="button"
                          key={s}
                          className="flex aspect-video items-center justify-center rounded-md bg-surface-3 text-[12px] font-medium shadow-surface-1 transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </TabPanel>
                  <TabPanel value="effects" className="min-h-0 flex-1 overflow-y-auto p-1">
                    {EFFECTS.map((e) => (
                      <button
                        type="button"
                        key={e.id}
                        className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
                      >
                        <span className="text-[12px] text-foreground">{e.name}</span>
                        <span className="text-[10px] text-muted-foreground">{e.description}</span>
                      </button>
                    ))}
                  </TabPanel>
                </Tabs>
              </Pane>
            </ResizablePanel>
            <ResizableHandle className="hover:bg-ring/60 transition-colors" />
            <ResizablePanel defaultSize="56" minSize="30">
              <Pane className="bg-surface-1">
                <PanelHeader title="Program" icon={Layers}>
                  <span className="text-[11px] text-muted-foreground">Fit · 1920×1080</span>
                </PanelHeader>
                <PreviewCanvas t={t} />
                <div className="flex h-10 shrink-0 items-center gap-3 border-t border-border px-3">
                  <TransportControls t={t} />
                  <Scrubber t={t} className="flex-1" />
                </div>
              </Pane>
            </ResizablePanel>
            <ResizableHandle className="hover:bg-ring/60 transition-colors" />
            <ResizablePanel defaultSize="22" minSize={220} collapsible collapsedSize={0}>
              <Pane>
                <Tabs value={rightTab} onValueChange={setRightTab} size="compact" className="flex min-h-0 flex-1 flex-col">
                  <div className="flex h-9 shrink-0 items-center border-b border-border px-1.5">
                    <TabsList>
                      <TabItem value="inspector" label="Inspector" icon={SlidersHorizontal} />
                      <TabItem value="clip" label="Clip" icon={Scissors} />
                    </TabsList>
                  </div>
                  <TabPanel value="inspector" className="min-h-0 flex-1 overflow-y-auto">
                    <InspectorFields />
                  </TabPanel>
                  <TabPanel value="clip" className="min-h-0 flex-1 overflow-y-auto p-3 text-[12px]">
                    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
                      <dt className="text-muted-foreground">Source</dt>
                      <dd className="text-right">screen_hooks_demo.mov</dd>
                      <dt className="text-muted-foreground">In point</dt>
                      <dd className="text-right tabular-nums">00:00:20.00</dd>
                      <dt className="text-muted-foreground">Duration</dt>
                      <dd className="text-right tabular-nums">00:00:41.00</dd>
                      <dt className="text-muted-foreground">Speed</dt>
                      <dd className="text-right tabular-nums">100%</dd>
                    </dl>
                  </TabPanel>
                </Tabs>
              </Pane>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle className="hover:bg-ring/60 transition-colors" />
        <ResizablePanel defaultSize="38" minSize={120}>
          <Pane>
            <PanelHeader title="Timeline">
              <Tooltip content="Split at playhead (S)" side="top">
                <Button variant="ghost" size="icon-compact" aria-label="Split">
                  <Scissors />
                </Button>
              </Tooltip>
              <Tooltip content="Snapping (N)" side="top">
                <Button
                  variant="ghost"
                  size="icon-compact"
                  aria-label="Toggle snapping"
                  active={snap}
                  onClick={() => setSnap((s) => !s)}
                >
                  <Magnet />
                </Button>
              </Tooltip>
            </PanelHeader>
            <TimelineStrip t={t} selectedClip={selectedClip} onClipSelect={setSelectedClip} className="flex-1" />
          </Pane>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
