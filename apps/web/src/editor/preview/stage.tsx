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
                {/* The stage is CSS-scaled, so undo that scale here: the note
                    reads at ~13px on screen for any project size or ratio. */}
                <span className="text-muted-foreground" style={{ fontSize: 13 / scale, whiteSpace: "nowrap" }}>
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
 * Layers bottom-to-top in track order, as one flat list keyed by clip id so
 * `<video>` elements survive effect clips starting and ending mid-playback.
 * An effect track applies to everything under it: its filter is handed to
 * each of those layers, which fold it into their content box. That keeps the
 * selection chrome (drawn outside the content box) crisp under a blur.
 */
function buildLayers({ doc, active, time, playing, selected, scale }: StackInput): ReactNode[] {
  const bottomUp = [...doc.tracks].reverse();
  const placed = new Set<string>();
  const entries: { clip: Clip; track?: Track; filters: string[] }[] = [];

  for (const track of bottomUp) {
    const clips = active.filter((c) => c.trackId === track.id);
    // Every clip on a real track is accounted for here, drawn or not, so the
    // orphan pass below never resurrects a hidden or audio clip.
    clips.forEach((c) => placed.add(c.id));
    if (track.kind === "audio") continue;
    if (track.kind === "effect") {
      const filter = track.hidden ? "" : stackFilter(clips, time);
      if (filter) for (const e of entries) e.filters.push(filter);
      continue;
    }
    if (track.hidden) continue;
    for (const clip of clips) entries.push({ clip, track, filters: [] });
  }

  // Clips on a track the document no longer has still deserve a picture.
  for (const clip of active) {
    if (placed.has(clip.id)) continue;
    const asset = clip.assetId ? assetById(doc, clip.assetId) : undefined;
    if (asset?.kind === "audio") continue;
    entries.push({ clip, track: trackById(doc, clip.trackId), filters: [] });
  }

  return entries.map(({ clip, track, filters }) => {
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
        stackFilter={filters.join(" ")}
      />
    );
  });
}
