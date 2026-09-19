import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "#/components/ui/button";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import { relativeTime, shortDuration, type Project } from "#/prototypes/mock";
import { ASPECT_PRESETS, AppHeader, InlineName, ProjectMenu, Thumb, aspectRatioValue, enterItem, matchesQuery, useProjectList } from "./shared";

/**
 * Launcher — new project is the hero. Four aspect presets are drawn as
 * pickable frames at their real proportions; choose one, name it, and go.
 * Recent projects are a compact sidebar list, always one click away but
 * never competing with the act of starting.
 */
export function Launcher() {
  const api = useProjectList();
  const reduce = useReducedMotion();
  const [aspect, setAspect] = useState<Project["aspect"]>("16:9");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");

  const preset = ASPECT_PRESETS.find((p) => p.aspect === aspect) ?? ASPECT_PRESETS[0];
  const recent = useMemo(
    () => [...api.projects].filter((p) => matchesQuery(p, query)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [api.projects, query]
  );

  const start = () => {
    api.create(aspect, name);
    setName("");
  };

  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <AppHeader>
        <span className="ml-3 text-[13px] text-muted-foreground">/ New project</span>
      </AppHeader>

      <div className="flex min-h-0 flex-1">
        {/* Hero: presets */}
        <main className="flex min-w-0 flex-1 flex-col items-center justify-center px-10 py-8">
          <motion.div {...(reduce ? {} : enterItem(0))} className="w-full max-w-3xl">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">What are you making?</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Pick a frame. Everything else has a sensible default you can change later.</p>

            <div role="radiogroup" aria-label="Aspect ratio" className="mt-7 grid grid-cols-4 gap-4">
              {ASPECT_PRESETS.map((p, i) => {
                const selected = p.aspect === aspect;
                const ratio = aspectRatioValue(p.aspect);
                return (
                  <motion.button
                    key={p.aspect}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAspect(p.aspect)}
                    onDoubleClick={start}
                    {...(reduce ? {} : enterItem(i + 1, 0.05))}
                    className={cn(
                      "group flex flex-col items-center gap-3 rounded-xl border p-4 pb-3.5 text-center outline-none transition-[border-color,background-color] duration-100",
                      selected ? "border-foreground/50 bg-surface-3" : "border-border/70 hover:border-border hover:bg-hover",
                      "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                    )}
                  >
                    <span className="grid h-28 w-full place-items-center">
                      <span
                        className={cn(
                          "block rounded-[3px] border-[1.5px] transition-[transform,border-color,background-color] duration-150 ease-out motion-reduce:transition-none",
                          selected ? "border-foreground bg-foreground/10 scale-100" : "border-muted-foreground/60 scale-[0.94] group-hover:scale-100 group-hover:border-foreground/70"
                        )}
                        style={ratio >= 1 ? { width: 112, height: 112 / ratio } : { height: 112, width: 112 * ratio }}
                      />
                    </span>
                    <span>
                      <span className="block text-[13px] font-medium">{p.label}</span>
                      <span className="mt-0.5 block text-[11.5px] tabular-nums text-muted-foreground">
                        {p.aspect} · {p.hint}
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <InputGroup className="flex-1">
                <InputField
                  index={0}
                  label="Project name"
                  labelHidden
                  placeholder={`Untitled ${preset.label} project`}
                  value={name}
                  onChange={setName}
                  onKeyDown={(e) => e.key === "Enter" && start()}
                />
              </InputGroup>
              <Button trailingIcon={ArrowRight} onClick={start}>
                Create {preset.aspect}
              </Button>
            </div>
            <p className="mt-3 text-[11.5px] text-muted-foreground">
              {preset.width} × {preset.height} · 30 fps · MP4. Press Enter to create.
            </p>
          </motion.div>
        </main>

        {/* Sidebar: recent */}
        <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-surface-2">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Recent</h2>
            <span className="text-[11px] tabular-nums text-muted-foreground">{recent.length}</span>
          </div>
          <div className="px-3 pb-2">
            <InputGroup size="compact">
              <InputField index={0} label="Search recent" labelHidden icon={Search} placeholder="Search" value={query} onChange={setQuery} />
            </InputGroup>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            <AnimatePresence initial={false}>
              {recent.map((p, i) => (
                <motion.li key={p.id} layout {...(reduce ? {} : enterItem(i, 0.025))}>
                  <RecentRow project={p} api={api} highlighted={api.recentId === p.id} />
                </motion.li>
              ))}
            </AnimatePresence>
            {recent.length === 0 && <li className="px-2 py-6 text-center text-[12px] text-muted-foreground">Nothing matches.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function RecentRow({ project, api, highlighted }: { project: Project; api: ReturnType<typeof useProjectList>; highlighted: boolean }) {
  const editing = api.editingId === project.id;
  return (
    <div className={cn("group/item relative flex items-center gap-2.5 rounded-md p-1.5 pr-1 transition-colors duration-80 hover:bg-hover", highlighted && "bg-selected/25")}>
      <button
        type="button"
        onClick={() => api.open(project.id)}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-20 rounded-[inherit] outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
      />
      <span className="grid h-9 w-14 shrink-0 place-items-center overflow-hidden rounded-[4px] bg-surface-4">
        <Thumb project={project} className={project.aspect === "16:9" ? "h-full w-full" : "h-[82%]"} />
      </span>
      <div className="min-w-0 flex-1">
        <InlineName project={project} editing={editing} onCommit={(n) => api.commitRename(project.id, n)} onCancel={api.cancelRename} className="text-[12.5px] font-medium" />
        <p className="mt-px text-[11px] tabular-nums text-muted-foreground">
          <Tooltip content={new Date(project.updatedAt).toLocaleString("ko-KR")} side="left">
            <span>{relativeTime(project.updatedAt)}</span>
          </Tooltip>
          {" · "}
          {project.aspect} · {project.duration ? shortDuration(project.duration) : "empty"}
        </p>
      </div>
      <ProjectMenu project={project} api={api} align="end" />
    </div>
  );
}
