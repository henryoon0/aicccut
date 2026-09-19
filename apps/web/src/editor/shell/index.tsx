/**
 * EditorShell — the Studio layout: a left icon rail with one flyout, the
 * preview and transport over a resizable timeline in the centre, and the
 * inspector collapsing to a rail on the right. Every panel body comes from
 * another area; this file only arranges them and owns the chrome.
 *
 * The route mounts it inside `EditorProvider` and owns boot, autosave and the
 * global shortcut listener, so the shell reads state and never loads it.
 * Shortcut confirmations go to the commands area's toast host, which
 * `CommandPalette` keeps mounted here.
 */
import { useEditorStore } from "#/editor/core";
import { CommandPalette, ShortcutsSheet } from "#/editor/commands";
import { ExportWizard } from "#/editor/export";
import { Preview, TransportBar } from "#/editor/preview";
import { Timeline } from "#/editor/timeline";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "#/components/ui/resizable.tsx";
import { useRailKeys, useSaveStatus, useTheme } from "./hooks";
import { InspectorColumn } from "./inspector-column";
import { ToolFlyout, ToolRail } from "./rail";
import { TopBar } from "./top-bar";

/** Centre column: preview over transport, split from the timeline. */
function Stage() {
  return (
    <ResizablePanelGroup orientation="vertical" className="min-h-0 min-w-0 flex-1">
      <ResizablePanel defaultSize="58" minSize={200}>
        <div className="flex h-full min-h-0 w-full flex-col">
          <div className="flex min-h-0 w-full flex-1 flex-col">
            <Preview />
          </div>
          <div className="flex shrink-0 flex-col">
            <TransportBar />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle className="transition-colors hover:bg-ring/60" />
      <ResizablePanel defaultSize="42" minSize={160}>
        <div className="flex h-full min-h-0 w-full flex-col bg-surface-2">
          <Timeline />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function EditorShell() {
  const store = useEditorStore();
  const saveStatus = useSaveStatus(store);
  const [theme, toggleTheme] = useTheme();
  useRailKeys();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-surface-1 text-foreground">
      <TopBar saveStatus={saveStatus} theme={theme} onToggleTheme={toggleTheme} />
      <div className="flex min-h-0 min-w-0 flex-1">
        <ToolRail />
        <ToolFlyout />
        <Stage />
        <InspectorColumn />
      </div>
      <ExportWizard />
      <CommandPalette />
      <ShortcutsSheet />
    </div>
  );
}
