/**
 * Precision — selecting a clip opens a trim panel above the timeline: two large
 * frame viewers either side of the edit point, ±1/±5/±10 frame nudges, numeric
 * in/out/duration fields, and a Roll mode that moves the cut between two
 * adjacent clips without changing the total length.
 */
import { useEffect, useState, type PointerEvent as RPE } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Kbd } from "#/components/ui/kbd";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { timecode } from "#/prototypes/mock";
import { applyRoll, applyTrim, endOf, FPS, FRAME, neighbors, sourceDuration, toFrames, useEditor, useEditorKeys, type EClip, type Edge, type EditorApi } from "./model";
import { ClipBox, EditorFrame, GhostExtent, TimelineBase, TRACK_H, trackIndex, useTrimDrag, type ClipCtx, type Geo } from "./shared";

type Mode = "trim" | "roll";
const EPS = 1e-3;

export function Precision() {
  const ed = useEditor();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [edge, setEdge] = useState<Edge>("start");
  const [mode, setMode] = useState<Mode>("trim");
  const { trim, start } = useTrimDrag(ed, geo);
  const clip = ed.primary;
  const nb = clip ? neighbors(ed.clips, clip) : {};
  const partner = clip ? (edge === "start" ? (nb.prev && Math.abs(endOf(nb.prev) - clip.start) < EPS ? nb.prev : undefined) : nb.next && Math.abs(nb.next.start - endOf(clip)) < EPS ? nb.next : undefined) : undefined;

  useEffect(() => {
    if (!partner && mode === "roll") setMode("trim");
  }, [partner, mode]);

  const nudge = (frames: number) => {
    if (!clip) return;
    if (mode === "roll" && partner) {
      const [l, r] = edge === "start" ? [partner, clip] : [clip, partner];
      ed.apply((cur) => applyRoll(cur, l.id, r.id, frames * FRAME));
    } else ed.nudge(clip.id, edge, frames);
  };

  useEditorKeys(ed, (e) => {
    if (e.metaKey || e.ctrlKey) return false;
    if (e.key === "," || e.key === "<") {
      nudge(e.shiftKey ? -5 : -1);
      return true;
    }
    if (e.key === "." || e.key === ">") {
      nudge(e.shiftKey ? 5 : 1);
      return true;
    }
    if (e.key.toLowerCase() === "i") {
      setEdge("start");
      return true;
    }
    if (e.key.toLowerCase() === "o") {
      setEdge("end");
      return true;
    }
    return false;
  });

  const renderClip = (ctx: ClipCtx) => {
    const c = ctx.clip;
    const rollPartner = mode === "roll" && partner?.id === c.id;
    return (
      <ClipBox
        ctx={ctx}
        faded={!!clip}
        className={cn("group cursor-default", rollPartner && "opacity-100!")}
        style={rollPartner ? { boxShadow: `inset 0 0 0 1.5px #ffd166, 0 0 0 1px ${c.tint}` } : undefined}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          ed.select(c.id, e.shiftKey);
        }}
      >
        <EdgeZone side="start" onDown={(e) => start(e, c, "start")} />
        <EdgeZone side="end" onDown={(e) => start(e, c, "end")} />
      </ClipBox>
    );
  };

  return (
    <EditorFrame
      ed={ed}
      above={
        <AnimatePresence initial={false}>
          {clip && (
            <motion.div
              key="panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 168, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.moderate}
              className="shrink-0 overflow-hidden border-t border-border bg-surface-3"
            >
              <TrimPanel ed={ed} clip={clip} edge={edge} setEdge={setEdge} mode={mode} setMode={setMode} partner={partner} nudge={nudge} />
            </motion.div>
          )}
        </AnimatePresence>
      }
      timeline={
        <TimelineBase
          ed={ed}
          onGeo={setGeo}
          renderClip={renderClip}
          overlay={(g) => (
            <>
              <GhostExtent trim={trim} geo={g} />
              {clip && <EditPointMarker geo={g} clip={clip} edge={edge} roll={mode === "roll"} />}
            </>
          )}
        />
      }
    />
  );
}

function EdgeZone({ side, onDown }: { side: Edge; onDown: (e: RPE) => void }) {
  return (
    <div
      className={cn("absolute inset-y-0 z-20 w-2 cursor-col-resize", side === "start" ? "left-0" : "right-0")}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onDown(e);
      }}
    />
  );
}

function EditPointMarker({ geo, clip, edge, roll }: { geo: Geo; clip: EClip; edge: Edge; roll: boolean }) {
  const t = edge === "start" ? clip.start : endOf(clip);
  const top = trackIndex(clip.trackId) * TRACK_H;
  return (
    <div className="pointer-events-none absolute z-20" style={{ left: geo.x(t), top, height: TRACK_H }}>
      <div className="absolute inset-y-0 -left-px w-0.5 bg-[#ffd166]" />
      <div className={cn("absolute top-0 flex h-4 items-center rounded-sm bg-[#ffd166] px-1 text-[9px] font-semibold tracking-wide text-black", edge === "start" ? "left-1" : "right-1")}>
        {roll ? "ROLL" : edge === "start" ? "IN" : "OUT"}
      </div>
    </div>
  );
}

function TrimPanel({ ed, clip, edge, setEdge, mode, setMode, partner, nudge }: { ed: EditorApi; clip: EClip; edge: Edge; setEdge: (e: Edge) => void; mode: Mode; setMode: (m: Mode) => void; partner?: EClip; nudge: (f: number) => void }) {
  const leftClip = edge === "start" ? partner : clip;
  const rightClip = edge === "start" ? clip : partner;
  const leftSrc = leftClip ? leftClip.inPoint + leftClip.duration - FRAME : null;
  const rightSrc = rightClip ? rightClip.inPoint : null;
  const cutT = edge === "start" ? clip.start : endOf(clip);
  const src = sourceDuration(clip);

  const setField = (field: "in" | "out" | "dur", value: number) => {
    ed.apply((cur) => {
      const c = cur.find((x) => x.id === clip.id);
      if (!c) return cur;
      if (field === "in") return applyTrim(cur, c.id, "start", value - c.inPoint, ed.ripple);
      if (field === "out") return applyTrim(cur, c.id, "end", value - (c.inPoint + c.duration), ed.ripple);
      return applyTrim(cur, c.id, "end", value - c.duration, ed.ripple);
    });
  };

  return (
    <div className="flex h-[168px] items-stretch gap-4 px-4 py-3">
      <div className="flex items-stretch gap-2">
        <FrameViewer clip={leftClip} srcTime={leftSrc} tag="OUT" side="left" />
        <div className="flex w-10 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-full w-px bg-[#ffd166]" />
          <span className="tabular-nums">{cutT.toFixed(2)}</span>
          <span className="h-full w-px bg-[#ffd166]" />
        </div>
        <FrameViewer clip={rightClip} srcTime={rightSrc} tag="IN" side="right" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex items-center gap-3">
          <Tabs value={edge} onValueChange={(v) => setEdge(v as Edge)} size="compact">
            <TabsList aria-label="Edit point">
              <TabItem value="start" label="In point" />
              <TabItem value="end" label="Out point" />
            </TabsList>
          </Tabs>
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} size="compact">
            <TabsList aria-label="Mode">
              <TabItem value="trim" label="Trim" />
              <TabItem value="roll" label="Roll" disabled={!partner} />
            </TabsList>
          </Tabs>
          <span className="truncate text-[11px] text-muted-foreground">
            {mode === "roll" && partner ? `Rolling the cut between ${leftClip?.label} and ${rightClip?.label}` : partner ? "Roll available: clips touch here" : "No adjacent clip · trim only"}
            {ed.ripple && mode === "trim" && " · ripple on"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <NudgeButton frames={-10} onClick={nudge} icon={ChevronsLeft} />
          <NudgeButton frames={-5} onClick={nudge} icon={ChevronsLeft} />
          <NudgeButton frames={-1} onClick={nudge} icon={ChevronLeft} />
          <span className="mx-2 w-28 text-center text-[12px] font-medium tabular-nums">{timecode(cutT)}</span>
          <NudgeButton frames={1} onClick={nudge} icon={ChevronRight} />
          <NudgeButton frames={5} onClick={nudge} icon={ChevronsRight} />
          <NudgeButton frames={10} onClick={nudge} icon={ChevronsRight} />
          <span className="ml-3 flex items-center gap-1 whitespace-nowrap text-[10px] text-muted-foreground">
            <Kbd>,</Kbd>
            <Kbd>.</Kbd>
            <span>1 frame</span>
            <Kbd className="ml-1">⇧</Kbd>
            <span>5 frames</span>
          </span>
        </div>

        <div className="flex items-end gap-3">
          <NumField label="In" value={clip.inPoint} onCommit={(v) => setField("in", v)} hint={`src 0 – ${Number.isFinite(src) ? src.toFixed(1) : "∞"}`} />
          <NumField label="Out" value={clip.inPoint + clip.duration} onCommit={(v) => setField("out", v)} />
          <NumField label="Duration" value={clip.duration} onCommit={(v) => setField("dur", v)} hint={`${toFrames(clip.duration)} f`} />
          <div className="ml-auto text-right text-[10px] leading-4 text-muted-foreground">
            <div>{clip.label}</div>
            <div className="tabular-nums">
              {timecode(clip.start)} → {timecode(endOf(clip))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NudgeButton({ frames, onClick, icon }: { frames: number; onClick: (f: number) => void; icon: typeof ChevronLeft }) {
  const n = Math.abs(frames);
  return (
    <Button
      variant="tertiary"
      size="compact"
      className="min-w-12 tabular-nums"
      aria-label={`${frames > 0 ? "+" : "−"}${n} frames`}
      leadingIcon={frames < 0 ? icon : undefined}
      trailingIcon={frames > 0 ? icon : undefined}
      onClick={() => onClick(frames)}
    >
      {String(n)}
    </Button>
  );
}

function FrameViewer({ clip, srcTime, tag, side }: { clip?: EClip; srcTime: number | null; tag: string; side: "left" | "right" }) {
  return (
    <div className={cn("relative aspect-video h-full overflow-hidden rounded-md bg-black/60 shadow-surface-2", !clip && "border border-dashed border-border")}>
      {clip && srcTime !== null ? (
        <>
          <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at ${side === "left" ? "70%" : "30%"} 30%, ${clip.tint} 0%, ${clip.tint}66 55%, #050507 100%)`, filter: `brightness(${1 + (srcTime % 1) * 0.3})` }} />
          <div className="absolute inset-x-2 top-2 flex items-center justify-between text-[9px] font-semibold tracking-wide">
            <span className="rounded-sm bg-black/50 px-1 py-0.5 text-white/90">{tag}</span>
            <span className="truncate pl-2 text-white/70">{clip.label}</span>
          </div>
          <div className="absolute inset-x-2 bottom-2 text-[12px] font-medium tabular-nums text-white drop-shadow">{timecode(Math.max(0, srcTime))}</div>
          <div className="absolute bottom-2 right-2 text-[9px] tabular-nums text-white/60">f {toFrames(Math.max(0, srcTime)) % FPS}</div>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">Gap</div>
      )}
    </div>
  );
}

function NumField({ label, value, onCommit, hint }: { label: string; value: number; onCommit: (v: number) => void; hint?: string }) {
  const [text, setText] = useState(value.toFixed(2));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value.toFixed(2));
  }, [value, focused]);
  const commit = () => {
    const v = parseTime(text);
    if (v !== null && Math.abs(v - value) > 1e-6) onCommit(v);
    else setText(value.toFixed(2));
  };
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
      <span>{label}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setText(value.toFixed(2));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-7 w-24 rounded-md bg-surface-1 px-2 text-[12px] tabular-nums text-foreground shadow-[inset_0_0_0_1px_var(--border)] outline-none focus-visible:shadow-[inset_0_0_0_1px_#6B97FF]"
      />
      {hint && <span className="tabular-nums">{hint}</span>}
    </label>
  );
}

/** Accepts "12.4", "1:02.5" or "00:01:02.15" (last field = frames). */
function parseTime(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (!t.includes(":")) {
    const v = Number(t.replace(/s$/i, ""));
    return Number.isFinite(v) ? v : null;
  }
  const parts = t.split(":").map((p) => p.trim());
  const last = parts.pop()!;
  const [secStr, frameStr] = last.split(".");
  let total = Number(secStr) + (frameStr ? Number(frameStr.padEnd(2, "0").slice(0, 2)) / FPS : 0);
  let mul = 60;
  for (const p of parts.reverse()) {
    total += Number(p) * mul;
    mul *= 60;
  }
  return Number.isFinite(total) ? total : null;
}
