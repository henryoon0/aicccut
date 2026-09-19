import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import { relativeTime, shortDuration, type Project } from "#/prototypes/mock";
import { AppHeader, InlineName, ProjectMenu, Thumb, enterItem, matchesQuery, useProjectList } from "./shared";

type Filter = "all" | Project["aspect"];
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
];

/**
 * Gallery — thumbnails first. Every project is a large tint tile in a
 * uniform 16:9 frame (portrait projects letterbox inside it), hover reveals
 * duration + aspect + fps, and "New project" is the first tile so starting
 * something new sits in the same grid as the work already there.
 */
export function Gallery() {
  const api = useProjectList();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => api.projects.filter((p) => matchesQuery(p, query) && (filter === "all" || p.aspect === filter)),
    [api.projects, query, filter]
  );

  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <AppHeader>
        <div className="ml-auto flex items-center gap-2">
          <InputGroup size="compact" className="w-56">
            <InputField index={0} label="Search projects" labelHidden icon={Search} placeholder="Search projects" value={query} onChange={setQuery} />
          </InputGroup>
          <Button size="compact" leadingIcon={Plus} onClick={() => api.create()}>
            New project
          </Button>
        </div>
      </AppHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Projects</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {visible.length} of {api.projects.length} · sorted by last edited
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
              <NewTile onClick={() => api.create()} />
            </motion.div>
            <AnimatePresence initial={false}>
              {visible.map((p, i) => (
                <motion.div key={p.id} layout {...(reduce ? {} : enterItem(i + 1))}>
                  <Tile project={p} api={api} highlighted={api.recentId === p.id} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {visible.length === 0 && (
            <p className="mt-16 text-center text-[13px] text-muted-foreground">No projects match “{query}”.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NewTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-xl border border-dashed border-border text-left outline-none",
        "transition-colors duration-100 hover:border-foreground/40 hover:bg-hover active:bg-active",
        "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
      )}
    >
      <div className="grid aspect-video w-full place-items-center">
        <span className="grid size-10 place-items-center rounded-full bg-surface-3 text-muted-foreground transition-[transform,color] duration-150 ease-out group-hover:scale-105 group-hover:text-foreground motion-reduce:transition-none">
          <Plus size={18} strokeWidth={1.5} />
        </span>
      </div>
      <div className="px-3.5 pb-3.5 pt-2">
        <p className="text-[13px] font-medium">New project</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">16:9 · 30 fps · 1080p</p>
      </div>
    </button>
  );
}

function Tile({ project, api, highlighted }: { project: Project; api: ReturnType<typeof useProjectList>; highlighted: boolean }) {
  const editing = api.editingId === project.id;
  return (
    <div
      className={cn(
        "group/item relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface-2 transition-[border-color,box-shadow] duration-150",
        highlighted ? "border-foreground/40" : "border-border/60 hover:border-border"
      )}
    >
      <button
        type="button"
        onClick={() => api.open(project.id)}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-20 rounded-[inherit] outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
      />

      {/* Uniform 16:9 frame; the project's real aspect letterboxes inside it. */}
      <div className="relative grid aspect-video w-full place-items-center overflow-hidden bg-surface-3">
        <Thumb
          project={project}
          className={cn("shadow-surface-4 transition-transform duration-200 ease-out group-hover/item:scale-[1.02] motion-reduce:transition-none", project.aspect === "16:9" ? "h-full w-full" : "h-[86%]")}
        />
        {/* Hover reveal: duration + aspect + fps */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2.5 opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 group-focus-within/item:opacity-100">
          <span className="text-[11px] font-medium tabular-nums text-white">
            {project.duration ? shortDuration(project.duration) : "Empty"}
          </span>
          <span className="flex gap-1">
            <Badge size="compact" className="bg-white/15 text-white">{project.aspect}</Badge>
            <Badge size="compact" className="bg-white/15 text-white">{project.fps} fps</Badge>
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2 px-3.5 pb-3 pt-2.5">
        <div className="min-w-0 flex-1">
          <InlineName
            project={project}
            editing={editing}
            onCommit={(n) => api.commitRename(project.id, n)}
            onCancel={api.cancelRename}
            className="text-[13px] font-medium"
          />
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Tooltip content={new Date(project.updatedAt).toLocaleString("ko-KR")} side="bottom">
              <span>{relativeTime(project.updatedAt)}</span>
            </Tooltip>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{project.clipCount} clips</span>
          </p>
        </div>
        <ProjectMenu project={project} api={api} className="-mr-1.5 -mt-0.5" />
      </div>
    </div>
  );
}
