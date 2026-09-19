/**
 * Persistent hint bar: teaches the keys that apply to whatever is selected,
 * and turns into a live readout while an edge is being trimmed.
 */
import { Kbd, KbdGroup } from "#/components/ui/kbd";
import { useEditor } from "#/editor/core";
import { cn } from "#/lib/utils";
import type { TrimState } from "./drag";
import { formatDelta } from "./geometry";
import { useKeyCaps } from "./keys";

export function HintBar({ trim }: { trim: TrimState | null }) {
  const caps = useKeyCaps();
  const ripple = useEditor((s) => s.ripple);
  const selection = useEditor((s) => s.selection.clipIds);
  const label = useEditor((s) => {
    const id = s.selection.clipIds[s.selection.clipIds.length - 1];
    return s.doc.clips.find((c) => c.id === id)?.label ?? "";
  });

  const hint = (shortcut: string, text: string) => (
    <span key={shortcut + text} className="flex items-center gap-1">
      <KbdGroup>
        {caps(shortcut).map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </KbdGroup>
      {text}
    </span>
  );

  return (
    <div className="flex h-8 shrink-0 items-center gap-3 overflow-hidden border-t border-border bg-surface-2 px-3 text-[11px] text-muted-foreground">
      {trim ? (
        <>
          <span className="font-medium text-foreground">
            Trimming {trim.edge} of {trim.label}
          </span>
          <span className={cn("font-medium tabular-nums", trim.delta < 0 ? "text-destructive" : "text-foreground")}>
            {formatDelta(trim.delta)}
          </span>
          <span className="tabular-nums">→ {trim.duration.toFixed(2)} s</span>
          {ripple && <span className="rounded-sm bg-selected px-1.5 py-0.5 text-foreground">ripple: following clips move</span>}
          <span className="ml-auto">Release to commit</span>
        </>
      ) : selection.length === 0 ? (
        <>
          <span>Click a clip to select</span>
          {hint("Shift", "click adds to the selection")}
          <span className="flex items-center gap-1">
            <Kbd>Right-click</Kbd> actions
          </span>
          {hint("Space", "play")}
          <RippleBadge ripple={ripple} caps={caps} />
        </>
      ) : (
        <>
          <span className="truncate font-medium text-foreground">{selection.length === 1 ? label : `${selection.length} clips`}</span>
          {hint("S", "split")}
          {hint("[", "trim start")}
          {hint("]", "trim end")}
          {hint("Backspace", ripple ? "ripple delete" : "delete")}
          {hint("Mod+D", "duplicate")}
          {hint("Shift+M", "mute")}
          {hint("I", "properties")}
          <RippleBadge ripple={ripple} caps={caps} />
        </>
      )}
    </div>
  );
}

function RippleBadge({ ripple, caps }: { ripple: boolean; caps: (s: string) => string[] }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1">
      {caps("R").map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
      ripple {ripple ? "on" : "off"}
    </span>
  );
}
