/**
 * Small pieces the inspector cards are built from: the raised card shell, a
 * labelled field, the reset button, the keyframe stopwatch and diamond, and
 * the hook that resolves the single selected clip.
 */
import type { CSSProperties, ReactNode } from "react";
import { RotateCcw, Timer } from "lucide-react";
import { Tooltip } from "#/components/ui/tooltip";
import { useActions, useEditor, useSelection, type Clip } from "#/editor/core";
import { cn } from "#/lib/utils";

/** The clip the inspector edits: the first of the selection, or null. */
export function useSelectedClip(): Clip | null {
  const { clipIds } = useSelection();
  const id = clipIds[0];
  return useEditor((s) => (id ? (s.doc.clips.find((c) => c.id === id) ?? null) : null));
}

/** Name of the track a clip sits on. */
export function useTrackName(trackId: string | undefined): string {
  return useEditor((s) => s.doc.tracks.find((t) => t.id === trackId)?.name ?? "");
}

// ── Card shell ─────────────────────────────────────────────

export function Card({
  title,
  onReset,
  resetDisabled,
  trailing,
  children,
}: {
  title: string;
  onReset?: () => void;
  resetDisabled?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface-3 p-4 shadow-surface-2">
      <header className="flex items-center gap-2">
        <h3 className="flex-1 text-[13px] font-semibold">{title}</h3>
        {trailing}
        {onReset && <ResetButton onClick={onReset} disabled={resetDisabled} />}
      </header>
      {children}
    </section>
  );
}

/** Label above a control. */
export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-[12px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Small circular reset button used in card headers. */
export function ResetButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip content="초기화" side="bottom">
      <button
        type="button"
        aria-label="초기화"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors duration-80",
          "hover:bg-hover hover:text-foreground active:bg-active focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          "disabled:pointer-events-none disabled:opacity-30",
        )}
      >
        <RotateCcw size={12} strokeWidth={1.75} />
      </button>
    </Tooltip>
  );
}

// ── Keyframe glyphs ────────────────────────────────────────

export function Diamond({ size = 9, color, hollow, className, style }: { size?: number; color?: string; hollow?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block rounded-[1px] border", className)}
      style={{
        width: size,
        height: size,
        background: hollow ? "transparent" : (color ?? "var(--foreground)"),
        borderColor: color ?? "var(--foreground)",
        transform: "rotate(45deg)",
        ...style,
      }}
    />
  );
}

/** Stopwatch toggle: on means the property is animated with keyframes. */
export function Stopwatch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <Tooltip content={on ? `${label} 애니메이션 끄기` : `${label} 애니메이션 켜기`}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${label} 애니메이션`}
        onClick={onToggle}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-sm outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-foreground/50",
          on ? "text-sky-400" : "text-muted-foreground/60",
        )}
      >
        <Timer size={13} strokeWidth={on ? 2.2 : 1.6} />
      </button>
    </Tooltip>
  );
}

/**
 * Wraps a control whose `onChange` fires continuously (sliders): every change
 * runs as a preview and the pointer/key release pushes one history entry.
 */
export function ScrubRegion({ children, className }: { children: ReactNode; className?: string }) {
  const actions = useActions();
  const end = () => actions.commit();
  return (
    <div
      className={cn("min-w-0", className)}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyUp={end}
      onBlurCapture={end}
    >
      {children}
    </div>
  );
}
