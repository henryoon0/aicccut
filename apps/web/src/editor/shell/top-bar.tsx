/**
 * Studio top bar: home link, editable project name, format chip, undo/redo,
 * autosave status, theme toggle, inspector toggle, ⌘K hint and Export.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Command, Moon, PanelRightClose, PanelRightOpen, Redo2, Share2, Sun, Undo2 } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import { Kbd } from "#/components/ui/kbd.tsx";
import { Tooltip } from "#/components/ui/tooltip.tsx";
import { cn } from "#/lib/utils.ts";
import { renameProject, useActions, useEditor, useEditorStore } from "#/editor/core";
import type { SaveStatus, Theme } from "./hooks";

function ProjectName() {
  const actions = useActions();
  const project = useEditor((s) => s.doc.project);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const start = () => {
    setDraft(project.name);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (!name || name === project.name) return;
    actions.renameProject(name);
    renameProject(project.id, name);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") setEditing(false);
  };

  return (
    <div className="flex min-w-0 items-center gap-2 px-1">
      <span className="size-2 shrink-0 rounded-sm" style={{ background: project.tint }} />
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          aria-label="Project name"
          className="h-6 w-48 min-w-0 rounded-md bg-surface-3 px-1.5 text-[13px] font-medium text-foreground shadow-surface-1 outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      ) : (
        <Tooltip content="Rename" side="bottom">
          <button
            type="button"
            onClick={start}
            className="h-6 max-w-56 truncate rounded-md px-1.5 text-[13px] font-medium text-foreground transition-colors duration-80 hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            {project.name}
          </button>
        </Tooltip>
      )}
      <span className="hidden shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground shadow-surface-1 lg:inline">
        {project.aspect} · {project.fps}fps · {project.width}×{project.height}
      </span>
    </div>
  );
}

function History() {
  const store = useEditorStore();
  // Re-render when history depth changes; the store's canUndo/canRedo do the reading.
  useEditor((s) => s.history.past.length + s.history.future.length * 1000);
  return (
    <div className="ml-1 flex items-center">
      <Tooltip content="Undo (⌘Z)" side="bottom">
        <Button variant="ghost" size="icon-compact" aria-label="Undo" disabled={!store.canUndo()} onClick={() => store.undo()}>
          <Undo2 />
        </Button>
      </Tooltip>
      <Tooltip content="Redo (⇧⌘Z)" side="bottom">
        <Button variant="ghost" size="icon-compact" aria-label="Redo" disabled={!store.canRedo()} onClick={() => store.redo()}>
          <Redo2 />
        </Button>
      </Tooltip>
    </div>
  );
}

export function TopBar({ saveStatus, theme, onToggleTheme }: { saveStatus: SaveStatus; theme: Theme; onToggleTheme: () => void }) {
  const actions = useActions();
  const inspectorOpen = useEditor((s) => s.uiPanels.inspector);
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-1 px-2">
      <div className="flex min-w-0 items-center gap-1">
        <Tooltip content="All projects" side="bottom">
          <Link to="/" aria-label="Back to projects" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-80 hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden">
            <ArrowLeft size={14} />
          </Link>
        </Tooltip>
        <ProjectName />
        <History />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <span
          aria-live="polite"
          className={cn("text-[11px] tabular-nums transition-colors duration-80", saveStatus === "saving" ? "text-foreground" : "text-muted-foreground")}
        >
          {saveStatus === "saving" ? "Saving…" : "Saved"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip content="Command palette" side="bottom">
          <Button variant="ghost" size="compact" aria-label="Open command palette" onClick={() => actions.setUi({ palette: true })}>
            <Command size={13} />
            <Kbd>⌘K</Kbd>
          </Button>
        </Tooltip>
        <Tooltip content={theme === "dark" ? "Light theme" : "Dark theme"} side="bottom">
          <Button variant="ghost" size="icon-compact" aria-label="Toggle theme" onClick={onToggleTheme}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </Tooltip>
        <Tooltip content={inspectorOpen ? "Hide inspector (I)" : "Show inspector (I)"} side="bottom">
          <Button variant="ghost" size="icon-compact" aria-label="Toggle inspector" onClick={() => actions.toggleUi("inspector")}>
            {inspectorOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </Button>
        </Tooltip>
        <Button variant="primary" size="compact" leadingIcon={Share2} onClick={() => actions.openDialog("export")}>
          Export
        </Button>
      </div>
    </header>
  );
}
