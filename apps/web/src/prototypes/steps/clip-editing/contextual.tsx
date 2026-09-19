/**
 * Contextual — the right-click menu is the primary surface. Every edit is a
 * named menu item with its shortcut beside it, and a persistent hint bar under
 * the timeline teaches the keys that apply to whatever is selected right now.
 */
import { useState, type PointerEvent as RPE } from "react";
import { Copy, Info, Scissors, Trash, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Kbd, KbdGroup } from "#/components/ui/kbd";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "#/components/ui/context-menu";
import { cn } from "#/lib/utils";
import { ASSETS, timecode } from "#/prototypes/mock";
import { endOf, fmtDelta, sourceDuration, useEditor, useEditorKeys, type EClip, type Edge, type EditorApi } from "./model";
import { ClipBox, EditorFrame, GhostExtent, TimelineBase, useTrimDrag, type ClipCtx, type Geo, type TrimState } from "./shared";

export function Contextual() {
  const ed = useEditor();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [propsFor, setPropsFor] = useState<string | null>(null);
  const { trim, start } = useTrimDrag(ed, geo);

  useEditorKeys(ed, (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod && e.key === "[") {
      ed.trimToPlayhead("start");
      return true;
    }
    if (!mod && e.key === "]") {
      ed.trimToPlayhead("end");
      return true;
    }
    if (mod && e.key.toLowerCase() === "i") {
      setPropsFor((p) => (p ? null : ed.primary?.id ?? null));
      return true;
    }
    return false;
  });

  const renderClip = (ctx: ClipCtx) => {
    const { clip } = ctx;
    const inside = ed.playhead > clip.start && ed.playhead < endOf(clip);
    return (
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <ClipBox
              ctx={ctx}
              className="group cursor-default"
              onPointerDown={(e: RPE) => {
                e.stopPropagation();
                if (e.button === 2) {
                  if (!ed.selection.includes(clip.id)) ed.select(clip.id, false);
                  return;
                }
                if (e.button === 0) ed.select(clip.id, e.shiftKey);
              }}
            >
              <EdgeZone side="start" onDown={(e) => start(e, clip, "start")} />
              <EdgeZone side="end" onDown={(e) => start(e, clip, "end")} />
            </ClipBox>
          }
        />
        <ContextMenuContent className="min-w-56 bg-surface-5 shadow-surface-5">
          <ContextMenuGroup>
            <ContextMenuLabel className="truncate">
              {clip.label} · {clip.duration.toFixed(1)} s
            </ContextMenuLabel>
          </ContextMenuGroup>
          <ContextMenuItem disabled={!inside} onClick={() => ed.split([clip.id])}>
            <Scissors /> Split at playhead <ContextMenuShortcut>S</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled={!inside} onClick={() => ed.trimToPlayhead("start", clip.id)}>
            Trim start to playhead <ContextMenuShortcut>[</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled={!inside} onClick={() => ed.trimToPlayhead("end", clip.id)}>
            Trim end to playhead <ContextMenuShortcut>]</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => ed.duplicate(clip.id)}>
            <Copy /> Duplicate <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => ed.toggleMute([clip.id])}>
            {clip.muted ? <Volume2 /> : <VolumeX />} {clip.muted ? "Unmute" : "Mute"} <ContextMenuShortcut>M</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => ed.remove(ed.selection.includes(clip.id) ? undefined : [clip.id], false)}>
            <Trash /> Delete <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={() => ed.remove(ed.selection.includes(clip.id) ? undefined : [clip.id], true)}>
            <Trash /> Ripple delete <ContextMenuShortcut>⇧⌫</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setPropsFor(clip.id)}>
            <Info /> Properties… <ContextMenuShortcut>⌘I</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const propsClip = propsFor ? ed.clips.find((c) => c.id === propsFor) : undefined;

  return (
    <EditorFrame
      ed={ed}
      previewOverlay={propsClip ? <PropertiesCard clip={propsClip} onClose={() => setPropsFor(null)} /> : null}
      timeline={
        <TimelineBase
          ed={ed}
          onGeo={setGeo}
          renderClip={renderClip}
          overlay={(g) => (
            <>
              <GhostExtent trim={trim} geo={g} />
            </>
          )}
        />
      }
      below={<HintBar ed={ed} trim={trim} />}
    />
  );
}

function EdgeZone({ side, onDown }: { side: Edge; onDown: (e: RPE) => void }) {
  return (
    <div
      className={cn("absolute inset-y-0 z-20 w-2 cursor-col-resize opacity-0 transition-opacity duration-100 hover:opacity-100", side === "start" ? "left-0" : "right-0")}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onDown(e);
      }}
    >
      <div className={cn("absolute inset-y-0 w-[3px] bg-white/90", side === "start" ? "left-0 rounded-l-md" : "right-0 rounded-r-md")} />
    </div>
  );
}

function HintBar({ ed, trim }: { ed: EditorApi; trim: TrimState | null }) {
  const n = ed.selected.length;
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 border-t border-border bg-surface-2 px-3 text-[11px] text-muted-foreground">
      {trim ? (
        <>
          <span className="font-medium text-foreground">
            Trimming {trim.edge} of {trim.original.label}
          </span>
          <span className={cn("tabular-nums font-medium", trim.delta < 0 ? "text-[#ff7a7a]" : "text-[#7ad9a1]")}>{fmtDelta(trim.delta)}</span>
          <span>→ {trim.current.duration.toFixed(1)} s</span>
          {ed.ripple && <span className="rounded-sm bg-selected px-1.5 py-0.5 text-foreground">ripple: following clips move</span>}
          <span className="ml-auto">Release to commit · ⌘Z to undo</span>
        </>
      ) : n === 0 ? (
        <>
          <span>Click a clip to select</span>
          <Hint keys={["⇧", "click"]} label="add to selection" />
          <Hint keys={["Right-click"]} label="actions" />
          <Hint keys={["Space"]} label="play" />
          <span className="ml-auto flex items-center gap-1">
            <Kbd>R</Kbd> ripple {ed.ripple ? "on" : "off"}
          </span>
        </>
      ) : (
        <>
          <span className="font-medium text-foreground">
            {n === 1 ? ed.primary?.label : `${n} clips`}
          </span>
          <Hint keys={["S"]} label="split" />
          <Hint keys={["["]} label="trim start" />
          <Hint keys={["]"]} label="trim end" />
          <Hint keys={["⌫"]} label={ed.ripple ? "ripple delete" : "delete"} />
          <Hint keys={["⇧", "⌫"]} label="ripple delete" />
          <Hint keys={["⌘", "D"]} label="duplicate" />
          <Hint keys={["M"]} label="mute" />
          <Hint keys={["⌘", "I"]} label="properties" />
          <span className="ml-auto flex items-center gap-1">
            <Kbd>R</Kbd> ripple {ed.ripple ? "on" : "off"}
          </span>
        </>
      )}
    </div>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <KbdGroup>
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </KbdGroup>
      {label}
    </span>
  );
}

function PropertiesCard({ clip, onClose }: { clip: EClip; onClose: () => void }) {
  const asset = clip.assetId ? ASSETS.find((a) => a.id === clip.assetId) : undefined;
  const src = sourceDuration(clip);
  const rows: [string, string][] = [
    ["Start", timecode(clip.start)],
    ["End", timecode(endOf(clip))],
    ["Duration", `${clip.duration.toFixed(2)} s`],
    ["Source in", timecode(clip.inPoint)],
    ["Source out", timecode(clip.inPoint + clip.duration)],
    ["Source", asset ? `${asset.name} · ${Number.isFinite(src) ? `${src.toFixed(1)} s` : "still"}` : "generated"],
  ];
  return (
    <div className="absolute right-3 top-3 w-60 rounded-lg bg-surface-6/95 p-3 text-[11px] shadow-surface-6 backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ background: clip.tint }} />
        <span className="truncate font-medium text-foreground">{clip.label}</span>
        <Button variant="ghost" size="icon-compact" aria-label="Close" className="ml-auto -mr-1" onClick={onClose}>
          <X size={12} />
        </Button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate text-right tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
