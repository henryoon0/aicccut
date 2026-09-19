import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { cn } from "#/lib/utils";
import { PROJECTS, type Project } from "#/prototypes/mock";

/** The "now" every relative label is measured against (matches mock.relativeTime). */
export const NOW_ISO = "2026-09-19T20:00:00+09:00";

export const ASPECT_PRESETS: {
  aspect: Project["aspect"];
  label: string;
  hint: string;
  width: number;
  height: number;
}[] = [
  { aspect: "16:9", label: "YouTube", hint: "1920 × 1080", width: 1920, height: 1080 },
  { aspect: "9:16", label: "Reels · Shorts", hint: "1080 × 1920", width: 1080, height: 1920 },
  { aspect: "1:1", label: "Square", hint: "1080 × 1080", width: 1080, height: 1080 },
  { aspect: "4:5", label: "Portrait", hint: "1080 × 1350", width: 1080, height: 1350 },
];

export function aspectRatioValue(aspect: Project["aspect"]): number {
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
}

// ── Project list state (shared by every variant) ─────────

export interface ProjectListApi {
  projects: Project[];
  /** Id of the project whose name is currently being edited inline. */
  editingId: string | null;
  /** Id of the project created or opened most recently — for highlight. */
  recentId: string | null;
  startRename: (id: string) => void;
  commitRename: (id: string, name: string) => void;
  cancelRename: () => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  create: (aspect?: Project["aspect"], name?: string) => Project;
  open: (id: string) => void;
}

export function useProjectList(): ProjectListApi {
  const [projects, setProjects] = useState<Project[]>(() => PROJECTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recentId, setRecentId] = useState<string | null>(null);
  const counter = useRef(0);

  const startRename = useCallback((id: string) => setEditingId(id), []);
  const cancelRename = useCallback(() => setEditingId(null), []);
  const commitRename = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (trimmed) setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    setEditingId(null);
  }, []);

  const duplicate = useCallback((id: string) => {
    setProjects((prev) => {
      const src = prev.find((p) => p.id === id);
      if (!src) return prev;
      counter.current += 1;
      const copy: Project = { ...src, id: `${src.id}-copy-${counter.current}`, name: `${src.name} (copy)`, updatedAt: NOW_ISO };
      const idx = prev.indexOf(src);
      setRecentId(copy.id);
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const create = useCallback((aspect: Project["aspect"] = "16:9", name?: string) => {
    counter.current += 1;
    const preset = ASPECT_PRESETS.find((p) => p.aspect === aspect) ?? ASPECT_PRESETS[0];
    const project: Project = {
      id: `new-${counter.current}`,
      name: name?.trim() || "Untitled project",
      aspect,
      fps: 30,
      width: preset.width,
      height: preset.height,
      duration: 0,
      updatedAt: NOW_ISO,
      tint: "#3f3f46",
      clipCount: 0,
    };
    setProjects((prev) => [project, ...prev]);
    setRecentId(project.id);
    // A project created without a name opens straight into rename.
    if (!name?.trim()) setEditingId(project.id);
    return project;
  }, []);

  const open = useCallback((id: string) => {
    setRecentId(id);
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, updatedAt: NOW_ISO } : p));
      next.sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : 0));
      return next;
    });
  }, []);

  return { projects, editingId, recentId, startRename, commitRename, cancelRename, duplicate, remove, create, open };
}

// ── Header chrome ────────────────────────────────────────

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-foreground text-background">
        <span className="block size-2 rounded-[1px] bg-background/0 border-[1.5px] border-current" />
      </span>
      <span className="text-[13px] font-semibold tracking-[-0.01em]">OpenCut</span>
    </span>
  );
}

export function AppHeader({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex h-12 shrink-0 items-center gap-3 border-b border-border px-4", className)}>
      <Wordmark />
      {children}
    </header>
  );
}

// ── Tint thumbnail ───────────────────────────────────────

export function Thumb({
  project,
  className,
  style,
  children,
}: {
  project: Project;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const empty = project.clipCount === 0;
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden bg-surface-3", className)}
      style={{
        aspectRatio: aspectRatioValue(project.aspect),
        background: empty
          ? undefined
          : `linear-gradient(135deg, ${project.tint} 0%, color-mix(in oklab, ${project.tint} 70%, black) 100%)`,
        ...style,
      }}
    >
      {!empty && (
        <span
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `radial-gradient(ellipse at 20% 20%, color-mix(in oklab, ${project.tint} 45%, white) 0%, transparent 55%)`,
          }}
        />
      )}
      {empty && <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0_8px,var(--hover)_8px_9px)]" />}
      {children}
    </div>
  );
}

// ── Inline rename ────────────────────────────────────────

export function InlineName({
  project,
  editing,
  onCommit,
  onCancel,
  className,
  inputClassName,
}: {
  project: Project;
  editing: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
  className?: string;
  inputClassName?: string;
}) {
  const [draft, setDraft] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(project.name);
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => cancelAnimationFrame(id);
    }
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
      aria-label="Project name"
      className={cn(
        "relative z-30 block w-full min-w-0 rounded-sm bg-surface-1 px-1 -mx-1 outline-none ring-1 ring-[color:var(--focus-ring,#6B97FF)]",
        className,
        inputClassName
      )}
    />
  );
}

// ── Context menu (Rename / Duplicate / Delete) ───────────

export function ProjectMenu({
  project,
  api,
  className,
  compact = true,
  align = "end",
  alwaysVisible = false,
}: {
  project: Project;
  api: Pick<ProjectListApi, "startRename" | "duplicate" | "remove">;
  className?: string;
  compact?: boolean;
  align?: "start" | "end" | "center";
  alwaysVisible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} size="compact">
      <DropdownTrigger
        render={
          <Button
            variant="ghost"
            size={compact ? "icon-compact" : "icon"}
            aria-label={`Actions for ${project.name}`}
            data-open={open || undefined}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative z-30",
              !alwaysVisible &&
                "opacity-0 transition-opacity duration-100 group-hover/item:opacity-100 focus-visible:opacity-100 data-[open]:opacity-100 data-[state=open]:opacity-100",
              className
            )}
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownContent align={align} className="min-w-40">
        <MenuItem index={0} icon={Pencil} label="Rename" onSelect={() => api.startRename(project.id)} />
        <MenuItem index={1} icon={Copy} label="Duplicate" onSelect={() => api.duplicate(project.id)} />
        <DropdownSeparator />
        <MenuItem index={2} icon={Trash2} label="Delete" className="text-destructive" onSelect={() => api.remove(project.id)} />
      </DropdownContent>
    </DropdownMenu>
  );
}

// ── Motion ───────────────────────────────────────────────

/** Entrance for list items: fade + 6px rise, ease-out, stagger by index. */
export const enterItem = (i: number, step = 0.03) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12 } },
  transition: { duration: 0.22, delay: Math.min(i * step, 0.24), ease: [0.16, 1, 0.3, 1] as const },
});

/** Full-width searchable filter. */
export function matchesQuery(project: Project, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return project.name.toLowerCase().includes(q) || project.aspect.includes(q) || String(project.fps).includes(q);
}
