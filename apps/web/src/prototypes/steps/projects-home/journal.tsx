import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { Button } from "#/components/ui/button";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { cn } from "#/lib/utils";
import { relativeTime, shortDuration, type Project } from "#/prototypes/mock";
import { AppHeader, InlineName, NOW_ISO, ProjectMenu, enterItem, matchesQuery, useProjectList } from "./shared";

type Bucket = "Today" | "Yesterday" | "This week" | "Earlier";
const ORDER: Bucket[] = ["Today", "Yesterday", "This week", "Earlier"];

/** Calendar-day index in KST so "yesterday 22:40" doesn't collapse into today. */
function dayIndex(iso: string) {
  return Math.floor((new Date(iso).getTime() + 9 * 3600_000) / 86_400_000);
}

function bucketOf(iso: string): Bucket {
  const d = dayIndex(NOW_ISO) - dayIndex(iso);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return "This week";
  return "Earlier";
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Seoul" });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
}

/**
 * Journal — time is the structure. Projects fall into "Today / Yesterday /
 * This week / Earlier" along a vertical rail, one quiet borders-only row
 * each, timestamps on the left like a log. Search sits on top and thins
 * the timeline rather than replacing it.
 */
export function Journal() {
  const api = useProjectList();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const sorted = [...api.projects]
      .filter((p) => matchesQuery(p, query))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const map = new Map<Bucket, Project[]>();
    for (const p of sorted) {
      const b = bucketOf(p.updatedAt);
      map.set(b, [...(map.get(b) ?? []), p]);
    }
    return ORDER.filter((b) => map.has(b)).map((b) => ({ bucket: b, items: map.get(b)! }));
  }, [api.projects, query]);

  let running = 0;

  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <AppHeader className="border-b-0">
        <div className="ml-auto flex items-center gap-2">
          <Button variant="tertiary" size="compact" leadingIcon={Plus} onClick={() => api.create()}>
            New
          </Button>
        </div>
      </AppHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 pb-20 pt-6">
          <InputGroup>
            <InputField index={0} label="Search projects" labelHidden icon={Search} placeholder="Search projects, aspect, fps…" value={query} onChange={setQuery} autoComplete="off" />
          </InputGroup>

          <div className="mt-8">
            <AnimatePresence initial={false}>
              {groups.map((g) => {
                const startIndex = running;
                running += g.items.length + 1;
                return (
                  <motion.section key={g.bucket} layout {...(reduce ? {} : enterItem(startIndex, 0.03))} className="relative pb-8 last:pb-0">
                    <div className="mb-3 flex items-baseline gap-3">
                      <h2 className="text-[13px] font-semibold tracking-[-0.01em]">{g.bucket}</h2>
                      <span className="text-[11.5px] tabular-nums text-muted-foreground">
                        {g.items.length} {g.items.length === 1 ? "project" : "projects"}
                      </span>
                    </div>
                    {/* the rail */}
                    <div className="relative border-l border-border pl-5">
                      <AnimatePresence initial={false}>
                        {g.items.map((p, i) => (
                          <motion.div key={p.id} layout {...(reduce ? {} : enterItem(startIndex + 1 + i, 0.03))}>
                            <Row project={p} api={api} highlighted={api.recentId === p.id} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.section>
                );
              })}
            </AnimatePresence>
            {groups.length === 0 && <p className="py-12 text-center text-[13px] text-muted-foreground">Nothing edited matches “{query}”.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ project, api, highlighted }: { project: Project; api: ReturnType<typeof useProjectList>; highlighted: boolean }) {
  const editing = api.editingId === project.id;
  return (
    <div className={cn("group/item relative -ml-5 flex items-start gap-4 border-b border-border/60 py-3 pl-5 pr-1 last:border-b-0", highlighted && "bg-selected/15")}>
      {/* dot on the rail */}
      <span
        aria-hidden
        className={cn("absolute -left-[4.5px] top-[19px] size-2 rounded-full ring-2 ring-surface-1 transition-transform duration-150 group-hover/item:scale-125 motion-reduce:transition-none")}
        style={{ background: project.clipCount ? project.tint : "var(--muted-foreground)" }}
      />
      <button
        type="button"
        onClick={() => api.open(project.id)}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-20 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
      />
      <time dateTime={project.updatedAt} className="w-[92px] shrink-0 pt-px text-[11.5px] leading-5 text-muted-foreground tabular-nums">
        <span className="block">{timeLabel(project.updatedAt)}</span>
        <span className="block text-muted-foreground/70">{dayLabel(project.updatedAt)}</span>
      </time>
      <div className="min-w-0 flex-1">
        <InlineName
          project={project}
          editing={editing}
          onCommit={(n) => api.commitRename(project.id, n)}
          onCancel={api.cancelRename}
          className="text-[13.5px] leading-5 font-medium transition-colors duration-80 group-hover/item:text-foreground"
        />
        <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground tabular-nums">
          {project.aspect} · {project.fps} fps · {project.duration ? shortDuration(project.duration) : "empty"} · {project.clipCount} clips
          <span className="text-muted-foreground/60"> · {relativeTime(project.updatedAt)}</span>
        </p>
      </div>
      <ProjectMenu project={project} api={api} className="mt-0.5" />
    </div>
  );
}
