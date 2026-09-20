import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { DropdownContent, DropdownMenu, DropdownSeparator, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { Skeleton } from "#/components/ui/skeleton";
import { Tooltip } from "#/components/ui/tooltip";
import { relativeTime, shortDuration, type Aspect, type ProjectSummary } from "#/editor/core";
import { cn } from "#/lib/utils";

const FOCUS = "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]";

export function aspectRatioValue(aspect: Aspect): number {
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
}

/** Entrance for grid items: fade + 6px rise, ease-out, stagger by index. */
export const enterItem = (i: number, step = 0.03) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12 } },
  transition: { duration: 0.22, delay: Math.min(i * step, 0.24), ease: [0.16, 1, 0.3, 1] as const },
});

export function matchesQuery(project: ProjectSummary, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return project.name.toLowerCase().includes(q) || project.aspect.includes(q) || String(project.fps).includes(q);
}

/** Actions a tile can ask the page to perform. */
export interface TileActions {
  editingId: string | null;
  pendingDeleteId: string | null;
  open: (id: string) => void;
  startRename: (id: string) => void;
  commitRename: (id: string, name: string) => void;
  cancelRename: () => void;
  duplicate: (id: string) => void;
  askDelete: (id: string) => void;
  confirmDelete: (id: string) => void;
  cancelDelete: () => void;
}

// ── Tint thumbnail ───────────────────────────────────────

export function Thumb({ project, className, style, children }: { project: ProjectSummary; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const empty = project.clipCount === 0;
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden bg-surface-3", className)}
      style={{
        aspectRatio: aspectRatioValue(project.aspect),
        background: empty ? undefined : `linear-gradient(135deg, ${project.tint} 0%, color-mix(in oklab, ${project.tint} 70%, black) 100%)`,
        ...style,
      }}
    >
      {!empty && (
        <span className="absolute inset-0 opacity-50" style={{ backgroundImage: `radial-gradient(ellipse at 20% 20%, color-mix(in oklab, ${project.tint} 45%, white) 0%, transparent 55%)` }} />
      )}
      {empty && <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0_8px,var(--hover)_8px_9px)]" />}
      {children}
    </div>
  );
}

// ── Inline rename ────────────────────────────────────────

function InlineName({ project, editing, onCommit, onCancel, className }: { project: ProjectSummary; editing: boolean; onCommit: (name: string) => void; onCancel: () => void; className?: string }) {
  const [draft, setDraft] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(project.name);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [editing, project.name]);

  if (!editing) return <span className={cn("block truncate", className)}>{project.name}</span>;

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onCommit(draft);
    if (e.key === "Escape") onCancel();
    e.stopPropagation();
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKey}
      onBlur={() => onCommit(draft)}
      onClick={(e) => e.stopPropagation()}
      aria-label="프로젝트 이름"
      className={cn("relative z-30 -mx-1 block w-full min-w-0 rounded-sm bg-surface-1 px-1 outline-none ring-1 ring-[color:var(--focus-ring,#6B97FF)]", className)}
    />
  );
}

// ── Context menu (Rename / Duplicate / Delete) ───────────

function ProjectMenu({ project, api, className }: { project: ProjectSummary; api: TileActions; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} size="compact">
      <DropdownTrigger
        render={
          <Button
            variant="ghost"
            size="icon-compact"
            aria-label={`${project.name} 메뉴`}
            data-open={open || undefined}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative z-30 opacity-0 transition-opacity duration-100 group-hover/item:opacity-100 focus-visible:opacity-100 data-[open]:opacity-100 data-[state=open]:opacity-100",
              className
            )}
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownContent align="end" className="min-w-40">
        <MenuItem index={0} icon={Pencil} label="이름 바꾸기" onSelect={() => api.startRename(project.id)} />
        <MenuItem index={1} icon={Copy} label="복제" onSelect={() => api.duplicate(project.id)} />
        <DropdownSeparator />
        <MenuItem index={2} icon={Trash2} label="삭제" className="text-destructive" onSelect={() => api.askDelete(project.id)} />
      </DropdownContent>
    </DropdownMenu>
  );
}

// ── Tiles ────────────────────────────────────────────────

export function NewTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-xl border border-dashed border-border text-left outline-none",
        "transition-colors duration-100 hover:border-foreground/40 hover:bg-hover active:bg-active",
        FOCUS
      )}
    >
      <div className="grid aspect-video w-full place-items-center">
        <span className="grid size-10 place-items-center rounded-full bg-surface-3 text-muted-foreground transition-[transform,color] duration-150 ease-out group-hover:scale-105 group-hover:text-foreground motion-reduce:transition-none">
          <Plus size={18} strokeWidth={1.5} />
        </span>
      </div>
      <div className="px-3.5 pb-3.5 pt-2">
        <p className="text-[13px] font-medium">새 프로젝트</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">16:9 · 30 fps · 1080p</p>
      </div>
    </button>
  );
}

export function SkeletonTile() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-surface-2">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function Tile({ project, api, highlighted }: { project: ProjectSummary; api: TileActions; highlighted: boolean }) {
  const editing = api.editingId === project.id;
  const confirming = api.pendingDeleteId === project.id;
  return (
    <div
      className={cn(
        "group/item relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface-2 transition-[border-color,box-shadow] duration-150",
        highlighted ? "border-foreground/40" : confirming ? "border-destructive/60" : "border-border/60 hover:border-border"
      )}
    >
      <button
        type="button"
        onClick={() => api.open(project.id)}
        aria-label={`${project.name} 열기`}
        className={cn("absolute inset-0 z-20 rounded-[inherit] outline-none", FOCUS)}
      />

      {/* Uniform 16:9 frame; the project's real aspect letterboxes inside it. */}
      <div className="relative grid aspect-video w-full place-items-center overflow-hidden bg-surface-3">
        <Thumb
          project={project}
          className={cn("shadow-surface-4 transition-transform duration-200 ease-out group-hover/item:scale-[1.02] motion-reduce:transition-none", project.aspect === "16:9" ? "h-full w-full" : "h-[86%]")}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2.5 opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 group-focus-within/item:opacity-100">
          <span className="text-[11px] font-medium tabular-nums text-white">{project.duration ? shortDuration(project.duration) : "비어 있음"}</span>
          <span className="flex gap-1">
            <Badge size="compact" className="bg-white/15 text-white">{project.aspect}</Badge>
            <Badge size="compact" className="bg-white/15 text-white">{project.fps} fps</Badge>
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2 px-3.5 pb-3 pt-2.5">
        <div className="min-w-0 flex-1">
          <InlineName project={project} editing={editing} onCommit={(n) => api.commitRename(project.id, n)} onCancel={api.cancelRename} className="text-[13px] font-medium" />
          {confirming ? (
            <div className="relative z-30 mt-1 flex items-center gap-1.5 text-[12px]">
              <span className="text-destructive">삭제할까요?</span>
              <Button variant="secondary" size="compact" className="h-6 px-2 text-[11px] text-destructive" onClick={() => api.confirmDelete(project.id)}>
                삭제
              </Button>
              <Button variant="ghost" size="compact" className="h-6 px-2 text-[11px]" onClick={api.cancelDelete}>
                취소
              </Button>
            </div>
          ) : (
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Tooltip content={new Date(project.updatedAt).toLocaleString("ko-KR")} side="bottom">
                {/* Lifted above the full-tile open button so the hover reaches it; clicking still opens. */}
                <span className="relative z-30 cursor-pointer" onClick={() => api.open(project.id)}>{relativeTime(project.updatedAt)}</span>
              </Tooltip>
              <span aria-hidden>·</span>
              <span className="tabular-nums">클립 {project.clipCount}개</span>
            </p>
          )}
        </div>
        {!confirming && <ProjectMenu project={project} api={api} className="-mr-1.5 -mt-0.5" />}
      </div>
    </div>
  );
}
