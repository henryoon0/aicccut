import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, Search } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { InputField, InputGroup } from "#/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { relativeTime, timecode, type Project } from "#/prototypes/mock";
import { AppHeader, InlineName, ProjectMenu, matchesQuery, useProjectList } from "./shared";

type SortKey = "name" | "aspect" | "fps" | "duration" | "clipCount" | "updatedAt";
type Dir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "right"; width: string }[] = [
  { key: "name", label: "Name", width: "auto" },
  { key: "aspect", label: "Aspect", width: "88px" },
  { key: "fps", label: "FPS", align: "right", width: "72px" },
  { key: "duration", label: "Duration", align: "right", width: "120px" },
  { key: "clipCount", label: "Clips", align: "right", width: "72px" },
  { key: "updatedAt", label: "Edited", align: "right", width: "120px" },
];

function compare(a: Project, b: Project, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, "ko");
    case "aspect":
      return a.aspect.localeCompare(b.aspect);
    case "updatedAt":
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    default:
      return a[key] - b[key];
  }
}

/**
 * Ledger — information first. A dense sortable table: every column is a
 * fact you'd otherwise hover to learn, sorted by a click on the header. The
 * tint survives only as a 4px spine on the row. New project lives in the
 * top bar, out of the data's way.
 */
export function Ledger() {
  const api = useProjectList();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: "updatedAt", dir: "desc" });

  const rows = useMemo(() => {
    const list = api.projects.filter((p) => matchesQuery(p, query));
    list.sort((a, b) => {
      const c = compare(a, b, sort.key);
      return sort.dir === "asc" ? c : -c;
    });
    return list;
  }, [api.projects, query, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "aspect" ? "asc" : "desc" }));

  const totalSeconds = rows.reduce((acc, p) => acc + p.duration, 0);
  const totalClips = rows.reduce((acc, p) => acc + p.clipCount, 0);

  return (
    <div className="flex h-full w-full flex-col bg-surface-1 text-foreground">
      <AppHeader>
        <nav className="ml-6 flex items-center gap-1 text-[13px]">
          <span className="rounded-md bg-selected/40 px-2 py-1 font-medium">Projects</span>
          <span className="rounded-md px-2 py-1 text-muted-foreground hover:bg-hover hover:text-foreground">Templates</span>
          <span className="rounded-md px-2 py-1 text-muted-foreground hover:bg-hover hover:text-foreground">Exports</span>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <InputGroup size="compact" className="w-64">
            <InputField index={0} label="Filter" labelHidden icon={Search} placeholder="Filter by name, aspect, fps" value={query} onChange={setQuery} />
          </InputGroup>
          <Button size="compact" leadingIcon={Plus} onClick={() => api.create()}>
            New project
          </Button>
        </div>
      </AppHeader>

      <div className="flex-1 overflow-auto px-4 pb-10 pt-4">
        <Table size="compact" className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-2 px-0" aria-hidden />
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <TableHead key={c.key} style={{ width: c.width }} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="p-0">
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "group flex h-7 w-full items-center gap-1 px-2.5 text-[12px] outline-none transition-colors duration-80",
                        c.align === "right" ? "flex-row-reverse text-right" : "text-left",
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                        "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                      )}
                    >
                      <span>{c.label}</span>
                      <span className={cn("transition-opacity duration-80", active ? "opacity-100" : "opacity-0 group-hover:opacity-60")}>
                        {active ? (sort.dir === "asc" ? <ArrowUp size={12} strokeWidth={1.75} /> : <ArrowDown size={12} strokeWidth={1.75} />) : <ChevronsUpDown size={12} strokeWidth={1.75} />}
                      </span>
                    </button>
                  </TableHead>
                );
              })}
              <TableHead className="w-9 p-0" aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p, i) => {
                const editing = api.editingId === p.id;
                return (
                    <TableRow
                      key={p.id}
                      index={i}
                      onDoubleClick={() => api.startRename(p.id)}
                      style={{ animationDelay: `${Math.min(i * 15, 120)}ms` }}
                      className={cn(
                        "group/item cursor-default animate-in fade-in-0 fill-mode-both duration-150 motion-reduce:animate-none",
                        api.recentId === p.id && "bg-selected/20"
                      )}
                    >
                      <TableCell className="w-2 p-0">
                        <span aria-hidden className="block h-4 w-1 rounded-full" style={{ background: p.clipCount ? p.tint : "var(--border)" }} />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {editing ? (
                          <InlineName project={p} editing onCommit={(n) => api.commitRename(p.id, n)} onCancel={api.cancelRename} className="text-[12.5px]" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => api.open(p.id)}
                            className="relative z-30 block max-w-full truncate rounded-sm text-left text-[12.5px] outline-none hover:underline underline-offset-2 focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
                          >
                            {p.name}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge size="compact" variant="dot">{p.aspect}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.fps}</TableCell>
                      <TableCell className="text-right font-mono text-[11.5px] tabular-nums">{timecode(p.duration, p.fps)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.clipCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{relativeTime(p.updatedAt)}</TableCell>
                      <TableCell className="p-0 pr-1">
                        <ProjectMenu project={p} api={api} />
                      </TableCell>
                    </TableRow>
                );
              })}
          </TableBody>
        </Table>

        <div className="mt-3 flex items-center justify-between px-3 text-[11.5px] text-muted-foreground tabular-nums">
          <span>{rows.length} projects{query && ` matching “${query}”`}</span>
          <span>
            {totalClips} clips · {timecode(totalSeconds)} total
          </span>
        </div>
      </div>
    </div>
  );
}
