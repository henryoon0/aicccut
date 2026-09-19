/**
 * Timeline toolbar: playhead readout, the two editing modes that change what
 * a drag does (snapping, ripple) and the log-scale zoom with Fit.
 */
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowExpand01Icon, ArrowShrink01Icon, Magnet01Icon, RippleIcon } from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button";
import { Slider } from "#/components/ui/slider";
import { Tooltip } from "#/components/ui/tooltip";
import { MAX_ZOOM_PPS, MIN_ZOOM_PPS, documentDuration, timecode, useActions, useEditor } from "#/editor/core";
import type { Viewport } from "./engine";
import { TimeReadout } from "./playhead";

export function Toolbar({ view }: { view: Viewport }) {
  const actions = useActions();
  const snapping = useEditor((s) => s.snapping);
  const ripple = useEditor((s) => s.ripple);
  const fps = useEditor((s) => s.doc.project.fps);
  const total = useEditor((s) => documentDuration(s.doc));

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface-3 px-2">
      <TimeReadout className="text-[12px] font-medium text-foreground" />
      <span className="text-[11px] text-muted-foreground">/ {timecode(total, fps)}</span>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip content={`Snapping ${snapping ? "on" : "off"} (N)`}>
          <Button variant="ghost" size="icon-compact" active={snapping} onClick={actions.toggleSnapping} aria-label="Toggle snapping">
            <HugeiconsIcon icon={Magnet01Icon} size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <Tooltip content={`Ripple editing ${ripple ? "on" : "off"} (R) — closes gaps when you trim or delete`}>
          <Button variant="ghost" size="icon-compact" active={ripple} onClick={actions.toggleRipple} aria-label="Toggle ripple editing">
            <HugeiconsIcon icon={RippleIcon} size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <div className="mx-1 h-4 w-px bg-border" />
        <Tooltip content="Zoom out (-)">
          <Button variant="ghost" size="icon-compact" onClick={() => view.zoomBy(0.8)} aria-label="Zoom out">
            <HugeiconsIcon icon={ArrowShrink01Icon} size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <div className="w-28">
          <Slider
            size="compact"
            min={Math.log(MIN_ZOOM_PPS)}
            max={Math.log(MAX_ZOOM_PPS)}
            step={0.01}
            showValue={false}
            value={Math.log(view.pps)}
            onChange={(v) => actions.setZoomPps(Math.exp(v as number))}
            aria-label="Zoom"
          />
        </div>
        <Tooltip content="Zoom in (=)">
          <Button variant="ghost" size="icon-compact" onClick={() => view.zoomBy(1.25)} aria-label="Zoom in">
            <HugeiconsIcon icon={ArrowExpand01Icon} size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <Tooltip content="Fit the whole project (⇧Z)">
          <Button
            variant="ghost"
            size="compact"
            onClick={() => {
              actions.zoomToFit();
              const el = view.scrollRef.current;
              if (el) el.scrollLeft = 0;
            }}
          >
            Fit
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
