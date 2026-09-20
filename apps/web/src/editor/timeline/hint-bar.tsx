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
            {trim.label} {trim.edge === "start" ? "시작점" : "끝점"} 트림 중
          </span>
          <span className={cn("font-medium tabular-nums", trim.delta < 0 ? "text-destructive" : "text-foreground")}>
            {formatDelta(trim.delta)}
          </span>
          <span className="tabular-nums">→ {trim.duration.toFixed(2)}초</span>
          {ripple && <span className="rounded-sm bg-selected px-1.5 py-0.5 text-foreground">리플: 뒤 클립이 따라 움직입니다</span>}
          <span className="ml-auto">놓으면 적용됩니다</span>
        </>
      ) : selection.length === 0 ? (
        <>
          <span>클립을 클릭해 선택</span>
          {hint("Shift", "클릭하면 선택에 추가")}
          <span className="flex items-center gap-1">
            <Kbd>우클릭</Kbd> 메뉴
          </span>
          {hint("Space", "재생")}
          <RippleBadge ripple={ripple} caps={caps} />
        </>
      ) : (
        <>
          <span className="truncate font-medium text-foreground">{selection.length === 1 ? label : `클립 ${selection.length}개`}</span>
          {hint("S", "분할")}
          {hint("[", "시작점 트림")}
          {hint("]", "끝점 트림")}
          {hint("Backspace", ripple ? "리플 삭제" : "삭제")}
          {hint("Mod+D", "복제")}
          {hint("Shift+M", "음소거")}
          {hint("I", "속성")}
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
      리플 {ripple ? "켬" : "꺼짐"}
    </span>
  );
}
