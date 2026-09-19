import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Moon, Plus, Search, Sun } from "lucide-react";
import { Button } from "#/components/ui/button";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { Tooltip } from "#/components/ui/tooltip";
import {
  createProject, deleteProject, duplicateProject, listProjects, renameProject, seedIfEmpty,
  type Aspect, type CreateProjectInput, type ProjectSummary,
} from "#/editor/core";
import { NewProjectDialog } from "./new-project-dialog";
import { useTheme } from "./theme";
import { NewTile, SkeletonTile, Tile, enterItem, matchesQuery, type TileActions } from "./tiles";

type Filter = "all" | Aspect;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
];

const editorHref = (projectId: string) => `/editor/${projectId}`;

/**
 * Home — the projects gallery. Every project is a tint tile in a uniform 16:9
 * frame, "New project" is the first tile, and the same Sheet dialog opens from
 * the header button. Projects live in localStorage, so the list is read in an
 * effect and skeleton tiles render until then (SSR-safe).
 */
export function HomePage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { theme, toggle } = useTheme();

  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const refresh = useCallback(() => setProjects(listProjects()), []);

  useEffect(() => {
    seedIfEmpty();
    refresh();
  }, [refresh]);

  const open = useCallback((id: string) => void navigate({ href: editorHref(id) }), [navigate]);

  const api: TileActions = useMemo(
    () => ({
      editingId,
      pendingDeleteId,
      open,
      startRename: (id) => { setPendingDeleteId(null); setEditingId(id); },
      commitRename: (id, name) => {
        const trimmed = name.trim();
        if (trimmed) { renameProject(id, trimmed); refresh(); }
        setEditingId(null);
      },
      cancelRename: () => setEditingId(null),
      duplicate: (id) => {
        const copy = duplicateProject(id);
        if (copy) setRecentId(copy.project.id);
        refresh();
      },
      askDelete: (id) => { setEditingId(null); setPendingDeleteId(id); },
      confirmDelete: (id) => { deleteProject(id); setPendingDeleteId(null); refresh(); },
      cancelDelete: () => setPendingDeleteId(null),
    }),
    [editingId, pendingDeleteId, open, refresh]
  );

  const create = useCallback(
    async (input: CreateProjectInput) => {
      const doc = createProject(input);
      await navigate({ href: editorHref(doc.project.id) });
    },
    [navigate]
  );

  const visible = useMemo(
    () => (projects ?? []).filter((p) => matchesQuery(p, query) && (filter === "all" || p.aspect === filter)),
    [projects, query, filter]
  );
  const loaded = projects !== null;

  return (
    <div className="flex h-dvh w-full flex-col bg-surface-1 text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <Wordmark />
        <div className="ml-auto flex items-center gap-2">
          <InputGroup size="compact" className="w-56">
            <InputField index={0} label="Search projects" labelHidden icon={Search} placeholder="Search projects" value={query} onChange={setQuery} />
          </InputGroup>
          <Tooltip content={theme === "dark" ? "Switch to light" : "Switch to dark"} side="bottom">
            <Button variant="ghost" size="icon-compact" aria-label="Toggle theme" onClick={toggle}>
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </Tooltip>
          <Button size="compact" leadingIcon={Plus} onClick={() => setSheetOpen(true)}>
            New project
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Projects</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {loaded ? `${visible.length} of ${projects.length} · sorted by last edited` : "Loading projects…"}
              </p>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} size="compact">
              <TabsList aria-label="Filter by aspect">
                {FILTERS.map((f) => (
                  <TabItem key={f.value} value={f.value} label={f.label} />
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
            <motion.div {...(reduce ? {} : enterItem(0))} layout>
              <NewTile onClick={() => setSheetOpen(true)} />
            </motion.div>
            {!loaded && Array.from({ length: 5 }, (_, i) => <SkeletonTile key={i} />)}
            <AnimatePresence initial={false}>
              {visible.map((p, i) => (
                <motion.div key={p.id} layout {...(reduce ? {} : enterItem(i + 1))}>
                  <Tile project={p} api={api} highlighted={recentId === p.id} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {loaded && visible.length === 0 && (
            <p className="mt-16 text-center text-[13px] text-muted-foreground">
              {projects.length === 0 ? "No projects yet. Create one to get started." : `No projects match “${query}”.`}
            </p>
          )}
        </div>
      </div>

      <NewProjectDialog open={sheetOpen} onOpenChange={setSheetOpen} onCreate={create} />
    </div>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex select-none items-center gap-2">
      <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-foreground text-background">
        <span className="block size-2 rounded-[1px] border-[1.5px] border-current bg-background/0" />
      </span>
      <span className="text-[13px] font-semibold tracking-[-0.01em]">OpenCut</span>
    </span>
  );
}
