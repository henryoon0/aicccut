"use client";

/**
 * Workbench — DaVinci/VS Code-style. Every panel group is tabbed and freely
 * splittable: left group (Media | Text | Effects), right group (Inspector |
 * Keyframes), timeline below. Layout presets (Edit / Color / Audio) and
 * "Reset layout" in the top bar reflow the splits with a short flex-grow
 * transition.
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useGroupRef } from "react-resizable-panels";
import { Diamond, Film, LayoutPanelLeft, RotateCcw, SlidersHorizontal, Sparkles, Type } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Tabs, TabsList, TabItem, TabPanel } from "#/components/ui/tabs.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { DropdownMenu, DropdownTrigger, DropdownContent, DropdownLabel, DropdownSeparator } from "#/components/ui/dropdown.tsx";
import { MenuItem } from "#/components/ui/menu-item.tsx";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "#/components/ui/resizable.tsx";
import { cn } from "#/lib/utils.ts";
import { CLIPS, EFFECTS, FONTS, PROJECT_DURATION } from "#/prototypes/mock";
import { InspectorFields, MediaGrid, PreviewCanvas, Scrubber } from "./panels";
import { TimelineStrip, TopBar, TransportControls, useTransport, useTransportKeys, type Transport } from "./shared";

type Preset = "edit" | "color" | "audio";

interface Layout {
  cols: { left: number; center: number; right: number };
  rows: { top: number; bottom: number };
  leftTab: string;
  rightTab: string;
}

const PRESETS: Record<Preset, Layout> = {
  edit: { cols: { left: 22, center: 54, right: 24 }, rows: { top: 60, bottom: 40 }, leftTab: "media", rightTab: "inspector" },
  color: { cols: { left: 0, center: 68, right: 32 }, rows: { top: 74, bottom: 26 }, leftTab: "effects", rightTab: "inspector" },
  audio: { cols: { left: 26, center: 74, right: 0 }, rows: { top: 42, bottom: 58 }, leftTab: "media", rightTab: "keyframes" },
};

const PRESET_LABEL: Record<Preset, string> = { edit: "Edit", color: "Color", audio: "Audio" };
const PRESET_ORDER: Preset[] = ["edit", "color", "audio"];

function GroupTabs({
  value,
  onValueChange,
  items,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  items: { value: string; label: string; icon: typeof Film }[];
  children: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} size="compact" className="flex h-full min-h-0 flex-col bg-surface-2">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-1.5">
        <TabsList>
          {items.map((i) => (
            <TabItem key={i.value} value={i.value} label={i.label} icon={i.icon} />
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

/** Keyframe lanes for the selected clip: diamonds on a per-property row. */
function KeyframesPanel({ t }: { t: Transport }) {
  const clip = CLIPS.find((c) => c.id === "c2")!;
  const props = [
    { name: "Position", keys: [0, 0.35, 1] },
    { name: "Scale", keys: [0, 1] },
    { name: "Opacity", keys: [0, 0.1, 0.9, 1] },
  ];
  const pct = (s: number) => `${(s / PROJECT_DURATION) * 100}%`;
  return (
    <div className="flex flex-col p-3 text-[12px]">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{clip.label}</span>
        <span className="text-[10px] text-muted-foreground">{props.reduce((n, p) => n + p.keys.length, 0)} keyframes</span>
      </div>
      {props.map((p) => (
        <div key={p.name} className="grid grid-cols-[72px_1fr] items-center gap-2 border-b border-border py-2 last:border-b-0">
          <span className="text-muted-foreground">{p.name}</span>
          <div className="relative h-4">
            <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-border" />
            {p.keys.map((k) => (
              <button
                type="button"
                key={k}
                aria-label={`${p.name} keyframe`}
                onClick={() => t.seek(clip.start + k * clip.duration)}
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] bg-foreground/80 outline-none transition-transform hover:scale-125 focus-visible:ring-1 focus-visible:ring-ring"
                style={{ left: pct(clip.start + k * clip.duration) }}
              />
            ))}
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-destructive"
              style={{ left: pct(Math.min(Math.max(t.time, clip.start), clip.start + clip.duration)) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Workbench() {
  const t = useTransport();
  useTransportKeys(t);
  const [preset, setPreset] = useState<Preset>("edit");
  const [leftTab, setLeftTab] = useState(PRESETS.edit.leftTab);
  const [rightTab, setRightTab] = useState(PRESETS.edit.rightTab);
  const [animating, setAnimating] = useState(false);
  const [selectedClip, setSelectedClip] = useState<string | null>("c2");
  const colsRef = useGroupRef();
  const rowsRef = useGroupRef();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback(
    (p: Preset) => {
      const L = PRESETS[p];
      setPreset(p);
      setLeftTab(L.leftTab);
      setRightTab(L.rightTab);
      setAnimating(true);
      // Let the transition class land before the imperative layout change.
      requestAnimationFrame(() => {
        colsRef.current?.setLayout(L.cols);
        rowsRef.current?.setLayout(L.rows);
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setAnimating(false), 260);
    },
    [colsRef, rowsRef]
  );

  const panelClass = cn(animating && "transition-[flex-grow] duration-200 ease-out");
  const handleClass = "hover:bg-ring/60 transition-colors";

  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <TopBar
        center={
          <Tabs value={preset} onValueChange={(v) => apply(v as Preset)} size="compact">
            <TabsList>
              {PRESET_ORDER.map((p) => (
                <TabItem key={p} value={p} label={PRESET_LABEL[p]} />
              ))}
            </TabsList>
          </Tabs>
        }
        trailing={
          <DropdownMenu size="compact">
            <DropdownTrigger
              render={
                <Button variant="ghost" size="icon-compact" aria-label="Layout">
                  <LayoutPanelLeft />
                </Button>
              }
            />
            <DropdownContent align="end">
              <DropdownLabel>Layout</DropdownLabel>
              <MenuItem index={0} icon={RotateCcw} label="Reset layout" onSelect={() => apply(preset)} />
              <DropdownSeparator />
              {PRESET_ORDER.map((p, i) => (
                <MenuItem key={p} index={i + 1} label={`${PRESET_LABEL[p]} workspace`} checked={preset === p} onSelect={() => apply(p)} />
              ))}
            </DropdownContent>
          </DropdownMenu>
        }
      />
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1" groupRef={rowsRef}>
        <ResizablePanel id="top" defaultSize={String(PRESETS.edit.rows.top)} minSize="25" className={panelClass}>
          <ResizablePanelGroup orientation="horizontal" groupRef={colsRef}>
            <ResizablePanel id="left" defaultSize={String(PRESETS.edit.cols.left)} minSize={180} collapsible collapsedSize={0} className={panelClass}>
              <GroupTabs
                value={leftTab}
                onValueChange={setLeftTab}
                items={[
                  { value: "media", label: "Media", icon: Film },
                  { value: "text", label: "Text", icon: Type },
                  { value: "effects", label: "Effects", icon: Sparkles },
                ]}
              >
                <TabPanel value="media" className="flex min-h-0 flex-1 flex-col">
                  <MediaGrid columns={2} filter={preset === "audio" ? "audio" : undefined} />
                </TabPanel>
                <TabPanel value="text" className="min-h-0 flex-1 overflow-y-auto p-2">
                  {FONTS.slice(0, 16).map((f) => (
                    <button
                      type="button"
                      key={f}
                      className="flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
                      style={{ fontFamily: `"${f}", sans-serif` }}
                    >
                      {f}
                    </button>
                  ))}
                </TabPanel>
                <TabPanel value="effects" className="min-h-0 flex-1 overflow-y-auto p-1">
                  {EFFECTS.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
                    >
                      <span className="text-[12px]">{e.name}</span>
                      <span className="text-[10px] text-muted-foreground">{e.description}</span>
                    </button>
                  ))}
                </TabPanel>
              </GroupTabs>
            </ResizablePanel>
            <ResizableHandle className={handleClass} />
            <ResizablePanel id="center" defaultSize={String(PRESETS.edit.cols.center)} minSize="30" className={panelClass}>
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-[12px] font-medium">
                  Viewer
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {preset === "color" ? "Rec.709 · Scopes on" : "Fit · 1920×1080"}
                  </span>
                </div>
                <PreviewCanvas t={t} className={cn(preset === "color" && "bg-surface-1")} />
                <div className="flex h-10 shrink-0 items-center gap-3 border-t border-border px-3">
                  <TransportControls t={t} />
                  <Scrubber t={t} className="flex-1" />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle className={handleClass} />
            <ResizablePanel id="right" defaultSize={String(PRESETS.edit.cols.right)} minSize={200} collapsible collapsedSize={0} className={panelClass}>
              <GroupTabs
                value={rightTab}
                onValueChange={setRightTab}
                items={[
                  { value: "inspector", label: "Inspector", icon: SlidersHorizontal },
                  { value: "keyframes", label: "Keyframes", icon: Diamond },
                ]}
              >
                <TabPanel value="inspector" className="min-h-0 flex-1 overflow-y-auto">
                  <InspectorFields />
                </TabPanel>
                <TabPanel value="keyframes" className="min-h-0 flex-1 overflow-y-auto">
                  <KeyframesPanel t={t} />
                </TabPanel>
              </GroupTabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle className={handleClass} />
        <ResizablePanel id="bottom" defaultSize={String(PRESETS.edit.rows.bottom)} minSize={110} className={panelClass}>
          <div className="flex h-full min-h-0 flex-col bg-surface-2">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-[12px] font-medium">
              Timeline
              <Tooltip content="Preset applies tab + split sizes together" side="top">
                <span className="ml-auto rounded-sm bg-surface-3 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground shadow-surface-1">
                  {PRESET_LABEL[preset]} workspace
                </span>
              </Tooltip>
            </div>
            <TimelineStrip
              t={t}
              trackHeight={preset === "audio" ? 40 : 28}
              selectedClip={selectedClip}
              onClipSelect={setSelectedClip}
              className="flex-1"
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
