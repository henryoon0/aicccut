/**
 * Razor — explicit tool modes. A segmented control (Select V · Razor C ·
 * Ripple R · Slip Y) changes what the pointer does. Razor shows a live blade
 * line and cuts on click; Slip slides the source window without moving the
 * clip; Ripple is a mode, not a switch.
 */
import { useEffect, useState, type PointerEvent as RPE } from "react";
import { AudioWaveform, MousePointer2, MoveHorizontal, Slice } from "lucide-react";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { Kbd } from "#/components/ui/kbd";
import { cn } from "#/lib/utils";
import { applySlip, canSlip, fmtDelta, sourceDuration, useEditor, useEditorKeys, type EClip } from "./model";
import { ClipBox, EditorFrame, GhostExtent, startPointerDrag, TimelineBase, UndoRedo, useTrimDrag, type ClipCtx, type Geo } from "./shared";

type Tool = "select" | "razor" | "ripple" | "slip";

const TOOLS: { id: Tool; label: string; key: string; icon: typeof MousePointer2; hint: string; cursor: string }[] = [
  { id: "select", label: "Select", key: "V", icon: MousePointer2, hint: "Click to select · drag clip edges to trim", cursor: "default" },
  { id: "razor", label: "Razor", key: "C", icon: Slice, hint: "Click a clip to cut it where the blade is", cursor: "crosshair" },
  { id: "ripple", label: "Ripple", key: "R", icon: AudioWaveform, hint: "Trim and delete close the gap behind them", cursor: "default" },
  { id: "slip", label: "Slip", key: "Y", icon: MoveHorizontal, hint: "Drag inside a clip to slide its source without moving it", cursor: "ew-resize" },
];

const TOOL_COLOR: Record<Tool, string> = { select: "#8fb3ff", razor: "#ff6b6b", ripple: "#7ad9a1", slip: "#ffd166" };

export function Razor() {
  const ed = useEditor();
  const [tool, setTool] = useState<Tool>("select");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [blade, setBlade] = useState<number | null>(null);
  const [slip, setSlip] = useState<{ id: string; from: number; to: number } | null>(null);
  const { trim, start } = useTrimDrag(ed, geo);

  useEffect(() => {
    ed.setRipple(tool === "ripple");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  useEditorKeys(ed, (e) => {
    if (e.metaKey || e.ctrlKey) return false;
    const k = e.key.toLowerCase();
    const hit = TOOLS.find((t) => t.key.toLowerCase() === k);
    if (!hit) return false;
    setTool((cur) => (cur === hit.id && hit.id !== "select" ? "select" : hit.id));
    return true;
  });

  const def = TOOLS.find((t) => t.id === tool)!;

  const beginSlip = (e: RPE, clip: EClip) => {
    if (!geo || !canSlip(clip)) return;
    const snapshot = ed.clips;
    setSlip({ id: clip.id, from: clip.inPoint, to: clip.inPoint });
    startPointerDrag(e, {
      onMove: (_ev, dx) => {
        const next = applySlip(snapshot, clip.id, -dx / geo.pps);
        ed.preview(next);
        setSlip({ id: clip.id, from: clip.inPoint, to: next.find((c) => c.id === clip.id)?.inPoint ?? clip.inPoint });
      },
      onEnd: () => {
        ed.commit(snapshot);
        setSlip(null);
      },
    });
  };

  const renderClip = (ctx: ClipCtx) => {
    const { clip } = ctx;
    const slippable = canSlip(clip);
    const src = sourceDuration(clip);
    const slipping = slip?.id === clip.id;
    return (
      <ClipBox
        ctx={ctx}
        className={cn("group", tool === "slip" && !slippable && "cursor-not-allowed", tool === "razor" && "hover:brightness-110")}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          if (tool === "razor") {
            const t = ctx.geo.timeAt(e.clientX);
            ed.split([clip.id], t);
            return;
          }
          if (tool === "slip") {
            ed.select(clip.id, false);
            beginSlip(e, clip);
            return;
          }
          ed.select(clip.id, e.shiftKey);
        }}
      >
        {(tool === "select" || tool === "ripple") && (
          <>
            <EdgeZone side="start" color={TOOL_COLOR[tool]} onDown={(e) => start(e, clip, "start")} />
            <EdgeZone side="end" color={TOOL_COLOR[tool]} onDown={(e) => start(e, clip, "end")} />
          </>
        )}
        {tool === "slip" && slippable && Number.isFinite(src) && (
          <div className="pointer-events-none absolute inset-x-1.5 bottom-[5px] h-[3px] rounded-full bg-black/35">
            <div
              className="absolute inset-y-0 rounded-full bg-[#ffd166]"
              style={{ left: `${(clip.inPoint / src) * 100}%`, width: `${Math.max(2, (clip.duration / src) * 100)}%` }}
            />
          </div>
        )}
        {slipping && slip && (
          <div className="pointer-events-none absolute right-1.5 top-[5px] rounded-sm bg-black/55 px-1.5 py-0.5 text-[10px] tabular-nums text-[#ffd166]">
            in {slip.from.toFixed(1)} → {slip.to.toFixed(1)} s
          </div>
        )}
      </ClipBox>
    );
  };

  return (
    <EditorFrame
      ed={ed}
      tools={<UndoRedo ed={ed} />}
      above={
        <div className="flex h-10 shrink-0 items-center gap-3 border-t border-border bg-surface-2 px-3">
          <Tabs value={tool} onValueChange={(v) => setTool(v as Tool)} size="compact">
            <TabsList aria-label="Tool">
              {TOOLS.map((t) => (
                <TabItem key={t.id} value={t.id} label={t.label} icon={t.icon} />
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            {TOOLS.map((t) => (
              <Kbd key={t.id} className={cn("transition-colors", tool === t.id && "bg-foreground text-background")}>
                {t.key}
              </Kbd>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium uppercase tracking-wide" style={{ background: `${TOOL_COLOR[tool]}22`, color: TOOL_COLOR[tool] }}>
              <span className="size-1.5 rounded-full" style={{ background: TOOL_COLOR[tool] }} />
              {def.label}
            </span>
            <span>{def.hint}</span>
          </div>
        </div>
      }
      timeline={
        <TimelineBase
          ed={ed}
          onGeo={setGeo}
          renderClip={renderClip}
          laneCursor={def.cursor}
          onLanePointerMove={(_e, t) => tool === "razor" && setBlade(t)}
          onLaneLeave={() => setBlade(null)}
          onLanePointerDown={(e) => {
            if (e.target === e.currentTarget && tool !== "razor") ed.clearSelection();
          }}
          overlay={(g) => (
            <>
              <GhostExtent trim={trim} geo={g} />
              {tool === "razor" && blade !== null && <BladeLine geo={g} t={blade} />}
              {trim && (
                <div
                  className="pointer-events-none absolute z-30 -translate-x-1/2 rounded-md px-2 py-1 text-[11px] font-medium tabular-nums text-black shadow-surface-5"
                  style={{ left: g.x(trim.edge === "start" ? trim.current.start : trim.current.start + trim.current.duration), top: -2, background: TOOL_COLOR[tool] }}
                >
                  {fmtDelta(trim.delta)}
                  {tool === "ripple" && " · ripple"}
                </div>
              )}
            </>
          )}
        />
      }
    />
  );
}

function EdgeZone({ side, color, onDown }: { side: "start" | "end"; color: string; onDown: (e: RPE) => void }) {
  return (
    <div
      className={cn("group/edge absolute inset-y-0 z-20 w-2 cursor-col-resize", side === "start" ? "left-0" : "right-0")}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onDown(e);
      }}
    >
      <div
        className={cn("absolute inset-y-0 w-[3px] opacity-0 transition-opacity duration-100 group-hover/edge:opacity-100", side === "start" ? "left-0 rounded-l-md" : "right-0 rounded-r-md")}
        style={{ background: color }}
      />
    </div>
  );
}

function BladeLine({ geo, t }: { geo: Geo; t: number }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 z-30" style={{ left: geo.x(t) }}>
      <div className="absolute inset-y-0 -left-px w-0.5 bg-[#ff6b6b] shadow-[0_0_8px_#ff6b6b]" />
      <div className="absolute left-1.5 top-0.5 flex items-center gap-1 whitespace-nowrap rounded-sm bg-[#ff6b6b] px-1 py-0.5 text-[10px] font-medium tabular-nums text-black">
        <Slice size={10} /> {t.toFixed(2)} s
      </div>
    </div>
  );
}
