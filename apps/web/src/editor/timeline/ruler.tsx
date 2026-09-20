/**
 * Time ruler: ticks, click / drag scrubbing and the document's bookmarks as
 * small flags (click seeks, right-click removes).
 */
import { useRef } from "react";
import { markPointed } from "./pointed";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Tooltip } from "#/components/ui/tooltip";
import { timecode, useActions, useEditor, useEditorContext } from "#/editor/core";
import type { Bookmark } from "#/editor/core";
import type { Viewport } from "./engine";
import { RULER_H, range, shortTime, tickSpec } from "./geometry";

export function Ruler({ view, onScrub }: { view: Viewport; onScrub: (e: ReactPointerEvent) => void }) {
  const { pps, contentW, duration, xToTime } = view;
  const { major, minor } = tickSpec(pps);
  const bookmarks = useEditor((s) => s.doc.bookmarks);
  const { time } = useEditorContext();
  // Assistive tech and some automation send a bare `click` with no pointer
  // events; a real press sets this flag first so it is not seeked twice.
  const pointed = useRef(false);

  return (
    <div
      data-testid="ruler"
      className="relative shrink-0 cursor-ew-resize select-none border-b border-border bg-surface-3"
      style={{ width: contentW, height: RULER_H }}
      onPointerDown={(e) => {
        markPointed(pointed);
        onScrub(e);
      }}
      onClick={(e) => {
        if (!pointed.current) time.set(xToTime(e.clientX));
      }}
    >
      {range(minor, duration).map((t) => (
        <div key={`m${t}`} className="absolute bottom-0 h-[5px] w-px bg-border" style={{ left: t * pps }} />
      ))}
      {range(major, duration).map((t) => (
        <div key={t} className="absolute bottom-0 flex flex-col items-start" style={{ left: t * pps }}>
          <span className="mb-0.5 translate-x-1 text-[10px] tabular-nums text-muted-foreground">{shortTime(t)}</span>
          <div className="h-2.5 w-px bg-muted-foreground" />
        </div>
      ))}
      {bookmarks.map((b) => (
        <BookmarkFlag key={b.id} bookmark={b} pps={pps} />
      ))}
    </div>
  );
}

function BookmarkFlag({ bookmark, pps }: { bookmark: Bookmark; pps: number }) {
  const actions = useActions();
  const { time } = useEditorContext();
  const fps = useEditor((s) => s.doc.project.fps);
  return (
    <Tooltip content={`${bookmark.label || "북마크"} · ${timecode(bookmark.time, fps)} · 우클릭으로 삭제`} side="top">
      <button
        type="button"
        aria-label={`북마크 ${timecode(bookmark.time, fps)}`}
        className="absolute top-0 z-10 h-3 w-2.5 cursor-pointer rounded-[1px] rounded-bl-none outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
        style={{ left: bookmark.time * pps, background: bookmark.color, clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)" }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => time.set(bookmark.time)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          actions.removeBookmark(bookmark.id);
        }}
      />
    </Tooltip>
  );
}
