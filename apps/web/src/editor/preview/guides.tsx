/** Non-interactive overlays drawn on top of the composited frame. */
import type { Project } from "#/editor/core";

interface GuideProps {
  project: Project;
}

/** Rule-of-thirds lines. */
export function Grid({ project }: GuideProps) {
  const { width: w, height: h } = project;
  return (
    <svg
      data-stage-bg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      {[1, 2].map((i) => (
        <line
          key={`v${i}`}
          x1={(w * i) / 3}
          y1={0}
          x2={(w * i) / 3}
          y2={h}
          stroke="white"
          strokeOpacity={0.35}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {[1, 2].map((i) => (
        <line
          key={`h${i}`}
          x1={0}
          y1={(h * i) / 3}
          x2={w}
          y2={(h * i) / 3}
          stroke="white"
          strokeOpacity={0.35}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/** Action safe (90%), title safe (80%) and a centre cross. */
export function SafeAreas({ project }: GuideProps) {
  const { width: w, height: h } = project;
  const label = Math.round(h * 0.021);
  const tick = Math.round(Math.min(w, h) * 0.02);
  return (
    <svg
      data-stage-bg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <rect
        x={w * 0.05}
        y={h * 0.05}
        width={w * 0.9}
        height={h * 0.9}
        fill="none"
        stroke="white"
        strokeOpacity={0.6}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={w * 0.1}
        y={h * 0.1}
        width={w * 0.8}
        height={h * 0.8}
        fill="none"
        stroke="white"
        strokeOpacity={0.6}
        strokeWidth={1}
        strokeDasharray="6 6"
        vectorEffect="non-scaling-stroke"
      />
      <line x1={w / 2 - tick} y1={h / 2} x2={w / 2 + tick} y2={h / 2} stroke="white" strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line x1={w / 2} y1={h / 2 - tick} x2={w / 2} y2={h / 2 + tick} stroke="white" strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={w * 0.05 + 8} y={h * 0.95 - 10} fill="white" fillOpacity={0.6} fontSize={label} fontFamily="Inter Variable, sans-serif">
        Action safe 90%
      </text>
      <text x={w * 0.1 + 8} y={h * 0.9 - 10} fill="white" fillOpacity={0.6} fontSize={label} fontFamily="Inter Variable, sans-serif">
        Title safe 80%
      </text>
    </svg>
  );
}
