"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { Button } from "#/components/ui/button.tsx";
import { PROJECTS, relativeTime, shortDuration, type Project } from "#/prototypes/mock";

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

export type Aspect = Project["aspect"];
export type Fps = Project["fps"];
export type Resolution = "1080p" | "4k" | "custom";

export interface AspectDef {
  id: Aspect;
  label: string;
  hint: string;
  w: number;
  h: number;
}

export const ASPECTS: readonly AspectDef[] = [
  { id: "16:9", label: "16:9", hint: "Landscape · YouTube", w: 16, h: 9 },
  { id: "9:16", label: "9:16", hint: "Vertical · Reels, Shorts", w: 9, h: 16 },
  { id: "1:1", label: "1:1", hint: "Square · Feed post", w: 1, h: 1 },
  { id: "4:5", label: "4:5", hint: "Portrait · Instagram", w: 4, h: 5 },
];

export const FPS_OPTIONS: readonly { value: Fps; label: string; hint: string }[] = [
  { value: 24, label: "24 fps", hint: "Film look" },
  { value: 25, label: "25 fps", hint: "PAL broadcast" },
  { value: 30, label: "30 fps", hint: "Web default" },
  { value: 60, label: "60 fps", hint: "Screen recordings, gameplay" },
];

export const RESOLUTIONS: readonly { value: Resolution; label: string; hint: string }[] = [
  { value: "1080p", label: "1080p", hint: "Full HD" },
  { value: "4k", label: "4K", hint: "Ultra HD" },
  { value: "custom", label: "Custom", hint: "Set width and height" },
];

export interface Draft {
  name: string;
  aspect: Aspect;
  fps: Fps;
  resolution: Resolution;
  customWidth: number;
  customHeight: number;
}

export const DEFAULT_DRAFT: Draft = {
  name: "",
  aspect: "16:9",
  fps: 30,
  resolution: "1080p",
  customWidth: 1920,
  customHeight: 1080,
};

export function aspectDef(id: Aspect): AspectDef {
  return ASPECTS.find((a) => a.id === id) ?? ASPECTS[0];
}

/** Pixel dimensions implied by a draft. The short side is 1080 (1080p) or
 *  2160 (4K); the long side follows the ratio. */
export function dimensionsFor(draft: Draft): { width: number; height: number } {
  if (draft.resolution === "custom") {
    return { width: draft.customWidth, height: draft.customHeight };
  }
  const short = draft.resolution === "4k" ? 2160 : 1080;
  const a = aspectDef(draft.aspect);
  if (a.w >= a.h) {
    return { width: Math.round((short * a.w) / a.h), height: short };
  }
  return { width: short, height: Math.round((short * a.h) / a.w) };
}

export function summaryLine(draft: Draft): string {
  const { width, height } = dimensionsFor(draft);
  return `${width}×${height} · ${draft.fps} fps · ${draft.aspect}`;
}

export function isFps(n: number): n is Fps {
  return n === 24 || n === 25 || n === 30 || n === 60;
}

export function isResolution(s: string): s is Resolution {
  return s === "1080p" || s === "4k" || s === "custom";
}

export function isAspect(s: string): s is Aspect {
  return ASPECTS.some((a) => a.id === s);
}

// ---------------------------------------------------------------------------
// Create flow: idle → creating (brief) → created
// ---------------------------------------------------------------------------

export type CreateStatus = "idle" | "creating" | "created";

export function useCreateFlow(delayMs = 900) {
  const [status, setStatus] = useState<CreateStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const create = useCallback(() => {
    setStatus("creating");
    timer.current = setTimeout(() => setStatus("created"), delayMs);
  }, [delayMs]);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setStatus("idle");
  }, []);

  return { status, create, reset };
}

// ---------------------------------------------------------------------------
// Visual atoms
// ---------------------------------------------------------------------------

/** A proportional rectangle for an aspect ratio, fitted inside a square box. */
export function AspectFrame({
  aspect,
  size = 40,
  className,
  children,
}: {
  aspect: Aspect;
  /** Box size in px; the frame's long side matches it. */
  size?: number;
  className?: string;
  children?: ReactNode;
}) {
  const a = aspectDef(aspect);
  const scale = size / Math.max(a.w, a.h);
  return (
    <div
      className={cn("relative rounded-[3px] border border-current", className)}
      style={{ width: a.w * scale, height: a.h * scale }}
    >
      {children}
    </div>
  );
}

/** Confirmation card shown after the brief loading state. */
export function CreatedNotice({
  draft,
  onReset,
  className,
}: {
  draft: Draft;
  onReset: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <div className="grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12.5l4.2 4.2L19 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="[stroke-dasharray:24] [stroke-dashoffset:24] animate-[draw_.3s_ease-out_forwards]"
          />
        </svg>
      </div>
      <div>
        <p className="text-[15px] font-semibold text-foreground">Created</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          <span className="text-foreground">{draft.name.trim()}</span>
          <br />
          <span className="tabular-nums">{summaryLine(draft)}</span>
        </p>
      </div>
      <Button variant="secondary" size="compact" onClick={onReset}>
        Make another
      </Button>
      <style>{`@keyframes draw { to { stroke-dashoffset: 0 } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home backdrop (the projects grid the new-project UI sits on top of)
// ---------------------------------------------------------------------------

export function ProjectTile({ project, className }: { project: Project; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg bg-surface-2 p-2 shadow-surface-2",
        className
      )}
    >
      <div
        className="grid aspect-video place-items-center overflow-hidden rounded-md"
        style={{ background: `linear-gradient(135deg, ${project.tint}cc, ${project.tint}55)` }}
      >
        <AspectFrame aspect={project.aspect} size={28} className="text-white/60" />
      </div>
      <div className="min-w-0 px-1 pb-1">
        <p className="truncate text-[13px] font-medium text-foreground">{project.name}</p>
        <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
          {project.aspect} · {project.fps} fps · {shortDuration(project.duration)} ·{" "}
          {relativeTime(project.updatedAt)}
        </p>
      </div>
    </div>
  );
}

export function HomeHeader({
  onNew,
  newActive = false,
  className,
}: {
  onNew?: () => void;
  newActive?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("flex items-center gap-3 px-8 pt-7 pb-5", className)}>
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Projects</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{PROJECTS.length} projects · sorted by last edited</p>
      </div>
      <div className="ml-auto">
        <Button variant="primary" leadingIcon={Plus} onClick={onNew} active={newActive}>
          New project
        </Button>
      </div>
    </header>
  );
}

/** Dimmed, non-interactive projects grid used as the stage behind a modal. */
export function HomeBackdrop({ dim = true, onNew }: { dim?: boolean; onNew?: () => void }) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col bg-surface-1 transition-opacity duration-200",
        dim && "opacity-60"
      )}
      aria-hidden={dim}
    >
      <HomeHeader onNew={onNew} />
      <div className="grid grid-cols-2 gap-4 px-8 pb-8 md:grid-cols-3 xl:grid-cols-4">
        {PROJECTS.map((p) => (
          <ProjectTile key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}
