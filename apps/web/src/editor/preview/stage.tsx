/**
 * `Preview` — the compositor. It renders every clip under the playhead into a
 * frame-sized stage and scales that stage to fit its slot, so the layers below
 * can work in plain canvas pixels.
 */
import { useRef, useState, type ReactNode } from "react";
import {
  assetById,
  clipsAt,
  trackById,
  useActions,
  useEditor,
  useSelection,
  useTime,
  useTransportState,
  type Clip,
  type Document,
  type Track,
} from "#/editor/core";
import { Grid, SafeAreas } from "./guides";
import { ClipLayer } from "./layer";
import { FIT_PADDING, fitScale, stackFilter, useIsoLayoutEffect, zoomScale } from "./helpers";

export function Preview() {
  const doc = useEditor((s) => s.doc);
  const zoom = useEditor((s) => s.uiPanels.previewZoom);
  const safeAreas = useEditor((s) => s.uiPanels.safeAreas);
  const grid = useEditor((s) => s.uiPanels.grid);
  const { clipIds } = useSelection();
  const { playing } = useTransportState();
  const actions = useActions();
  const time = useTime();

  const { project } = doc;
  const boxRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.35);

  useIsoLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFit(fitScale(r.width, r.height, project.width, project.height));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project.width, project.height]);

  const scale = zoomScale(zoom, fit);
  const active = clipsAt(doc, time);
  const layers = buildLayers({ doc, active, time, playing, selected: clipIds, scale });

  return (
    <div
      ref={boxRef}
      data-preview-stage
      className="relative h-full min-h-0 w-full min-w-0 flex-1 overflow-auto bg-background"
      onPointerDown={(e) => {
        const el = e.target as HTMLElement;
        if (el === e.currentTarget || el.dataset.stageBg !== undefined) actions.clearSelection();
      }}
    >
      <div data-stage-bg className="flex h-max min-h-full w-max min-w-full items-center justify-center" style={{ padding: FIT_PADDING }}>
        <div className="relative shrink-0" style={{ width: project.width * scale, height: project.height * scale }}>
          <div
            data-stage-bg
            className="absolute left-0 top-0 origin-top-left overflow-hidden rounded-[2px] bg-black shadow-surface-4"
            style={{ width: project.width, height: project.height, transform: `scale(${scale})` }}
          >
            {layers}
            {grid && <Grid project={project} />}
            {safeAreas && <SafeAreas project={project} />}
            {active.length === 0 && (
              <div data-stage-bg className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-muted-foreground" style={{ fontSize: Math.round(project.width * 0.016) }}>
                  재생 헤드 위치에 클립이 없습니다
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StackInput {
  doc: Document;
  active: Clip[];
  time: number;
  playing: boolean;
  selected: string[];
  scale: number;
}

/**
 * Layers bottom-to-top in track order. An effect track wraps everything under
 * it in a filtered box; the wrapper is emitted whether or not it filters, so
 * the tree shape never changes and `<video>` elements survive playback.
 */
function buildLayers({ doc, active, time, playing, selected, scale }: StackInput): ReactNode[] {
  const bottomUp = [...doc.tracks].reverse();
  const placed = new Set<string>();
  let stack: ReactNode[] = [];

  const layerFor = (clip: Clip, track?: Track) => {
    placed.add(clip.id);
    const asset = clip.assetId ? assetById(doc, clip.assetId) : undefined;
    return (
      <ClipLayer
        key={clip.id}
        clip={clip}
        time={time}
        project={doc.project}
        kind={asset?.kind}
        playing={playing}
        muted={clip.muted === true || track?.muted === true}
        selected={selected.includes(clip.id)}
        stageScale={scale}
        interactive={track?.locked !== true}
      />
    );
  };

  for (const track of bottomUp) {
    if (track.kind === "audio") continue;
    const clips = active.filter((c) => c.trackId === track.id);
    if (track.kind === "effect") {
      clips.forEach((c) => placed.add(c.id));
      const filter = track.hidden ? "" : stackFilter(clips, time);
      stack = [
        <div key={`fx-${track.id}`} className="absolute inset-0" style={filter ? { filter } : undefined}>
          {stack}
        </div>,
      ];
      continue;
    }
    if (track.hidden) continue;
    for (const clip of clips) stack.push(layerFor(clip, track));
  }

  // Clips on a track the document no longer has still deserve a picture.
  for (const clip of active) {
    if (placed.has(clip.id)) continue;
    const asset = clip.assetId ? assetById(doc, clip.assetId) : undefined;
    if (asset?.kind === "audio") continue;
    stack.push(layerFor(clip, trackById(doc, clip.trackId)));
  }
  return stack;
}
