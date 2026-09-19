import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Plus } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import { relativeTime, shortDuration, timecode, type Project } from "#/prototypes/mock";
import { AppHeader, InlineName, ProjectMenu, Thumb, enterItem, useProjectList } from "./shared";

/**
 * Focus — one project dominates. The most recently edited project is a
 * huge card with "Continue editing"; everything else waits in a small strip
 * below. Clicking a strip item promotes it to the hero. New project is
 * secondary, up in the header.
 */
export function Focus() {
  const api = useProjectList();
  const reduce = useReducedMotion();
  const [heroId, setHeroId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...api.projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [api.projects]
  );
  const hero = sorted.find((p) => p.id === heroId) ?? sorted[0];
  const rest = sorted.filter((p) => p.id !== hero?.id);

  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <AppHeader>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="compact" onClick={() => setHeroId(null)}>
            All projects
          </Button>
          <Button variant="secondary" size="compact" leadingIcon={Plus} onClick={() => setHeroId(api.create().id)}>
            New project
          </Button>
        </div>
      </AppHeader>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-6">
          <AnimatePresence mode="wait" initial={false}>
            {hero ? (
              <motion.div
                key={hero.id}
                initial={reduce ? false : { opacity: 0, scale: 0.985, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-5xl"
              >
                <Hero project={hero} api={api} />
              </motion.div>
            ) : (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] text-muted-foreground">
                No projects yet. Start one from the header.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="shrink-0 border-t border-border bg-surface-2">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-8 pt-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Earlier</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{rest.length} projects</span>
          </div>
          <div className="mx-auto flex w-full max-w-5xl gap-3 overflow-x-auto px-8 pb-5 pt-2.5">
            <AnimatePresence initial={false}>
              {rest.map((p, i) => (
                <motion.div key={p.id} layout {...(reduce ? {} : enterItem(i, 0.035))} className="shrink-0">
                  <StripItem project={p} api={api} onPromote={() => setHeroId(p.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero({ project, api }: { project: Project; api: ReturnType<typeof useProjectList> }) {
  const editing = api.editingId === project.id;
  return (
    <div className="group/item grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.35fr)_minmax(260px,1fr)] md:items-center">
      <div className="grid place-items-center">
        <Thumb
          project={project}
          className={cn("rounded-2xl shadow-surface-6 ring-1 ring-white/5", project.aspect === "16:9" ? "w-full" : project.aspect === "9:16" ? "h-[52vh] max-h-[560px]" : "h-[46vh] max-h-[480px]")}
        >
          <span className="absolute bottom-3 left-3 rounded-md bg-black/50 px-2 py-1 font-mono text-[11px] tabular-nums text-white backdrop-blur-sm">
            {timecode(project.duration, project.fps)}
          </span>
        </Thumb>
      </div>

      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Last edited {relativeTime(project.updatedAt)}</p>
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 flex-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] [&_input]:text-[26px] [&_input]:font-semibold">
            <InlineName
              project={project}
              editing={editing}
              onCommit={(n) => api.commitRename(project.id, n)}
              onCancel={api.cancelRename}
              className="whitespace-normal"
            />
          </h1>
          <ProjectMenu project={project} api={api} compact={false} alwaysVisible className="mt-0.5" />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 text-[13px]">
          <Stat label="Aspect" value={project.aspect} />
          <Stat label="Resolution" value={`${project.width} × ${project.height}`} />
          <Stat label="Frame rate" value={`${project.fps} fps`} />
          <Stat label="Duration" value={project.duration ? shortDuration(project.duration) : "Empty"} />
          <Stat label="Clips" value={String(project.clipCount)} />
          <Stat label="Format" value="MP4 · H.264" />
        </dl>
        <div className="mt-6 flex items-center gap-2">
          <Button trailingIcon={ArrowRight} onClick={() => api.open(project.id)}>
            Continue editing
          </Button>
          <Button variant="ghost" onClick={() => api.duplicate(project.id)}>
            Duplicate
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function StripItem({ project, api, onPromote }: { project: Project; api: ReturnType<typeof useProjectList>; onPromote: () => void }) {
  const editing = api.editingId === project.id;
  return (
    <div className="group/item relative w-[188px] rounded-lg p-1.5 transition-colors duration-100 hover:bg-hover">
      <button
        type="button"
        onClick={onPromote}
        aria-label={`Show ${project.name}`}
        className="absolute inset-0 z-20 rounded-[inherit] outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
      />
      <div className="grid aspect-video place-items-center overflow-hidden rounded-md bg-surface-4">
        <Thumb project={project} className={cn("shadow-surface-3", project.aspect === "16:9" ? "h-full w-full" : "h-[84%]")} />
      </div>
      <div className="mt-2 flex items-start gap-1 px-0.5">
        <div className="min-w-0 flex-1">
          <InlineName project={project} editing={editing} onCommit={(n) => api.commitRename(project.id, n)} onCancel={api.cancelRename} className="text-[12px] font-medium" />
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Tooltip content={new Date(project.updatedAt).toLocaleString("ko-KR")} side="top">
              <span>{relativeTime(project.updatedAt)}</span>
            </Tooltip>
            <Badge size="compact" variant="dot" className="h-4 px-1.5 text-[10px]">{project.aspect}</Badge>
          </p>
        </div>
        <ProjectMenu project={project} api={api} className="-mr-1 -mt-1" />
      </div>
    </div>
  );
}
