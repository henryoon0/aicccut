/**
 * Quiet neighbours for the clip-editing stage: the media rail on the left and
 * the preview that answers the playhead and the selection.
 */
import type { ReactNode } from "react";
import { VolumeX } from "lucide-react";
import { ASSETS } from "#/prototypes/mock";
import { clipsAt, type EditorApi } from "./model";

export function MediaRail() {
  return (
    <aside className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border bg-surface-2 p-2 md:flex">
      <div className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">Media</div>
      {ASSETS.slice(0, 7).map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-md px-1 py-1 text-[11px] text-muted-foreground hover:bg-hover">
          <span className="size-6 shrink-0 rounded-sm" style={{ background: `linear-gradient(135deg, ${a.tint}, ${a.tint}88)` }} />
          <span className="truncate">{a.name}</span>
        </div>
      ))}
    </aside>
  );
}

export function Preview({ ed, children }: { ed: EditorApi; children?: ReactNode }) {
  const here = clipsAt(ed.clips, ed.playhead);
  const video = here.filter((c) => c.trackId === "t-v2")[0] ?? here.filter((c) => c.trackId === "t-v1")[0];
  const texts = here.filter((c) => c.trackId === "t-text");
  const fx = here.filter((c) => c.trackId === "t-fx");
  const sel = ed.primary;
  const bg = video ? `radial-gradient(120% 90% at 30% 20%, ${video.tint} 0%, ${video.tint}66 55%, #0a0a0c 100%)` : "#0a0a0c";
  return (
    <section className="relative flex min-w-0 flex-1 items-center justify-center bg-surface-1 p-4">
      <div
        className="relative aspect-video max-h-full w-full max-w-[880px] overflow-hidden rounded-lg shadow-surface-3 transition-[box-shadow] duration-150"
        style={{ boxShadow: sel ? `0 0 0 2px ${sel.tint}` : undefined }}
      >
        <div className="absolute inset-0" style={{ background: bg, filter: fx.length ? "blur(6px)" : undefined }} />
        {texts.map((t) => (
          <div key={t.id} className="absolute inset-x-0 top-[14%] text-center text-[clamp(14px,2.6vw,30px)] font-semibold tracking-tight text-[#ffd166] drop-shadow">
            {t.label}
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3 text-[11px] text-white/80">
          <span className="rounded-sm bg-black/40 px-1.5 py-0.5 tabular-nums">{video ? `${video.label} · src ${(video.inPoint + (ed.playhead - video.start)).toFixed(2)} s` : "No clip"}</span>
          {video?.muted && (
            <span className="flex items-center gap-1 rounded-sm bg-black/40 px-1.5 py-0.5">
              <VolumeX size={11} /> muted
            </span>
          )}
        </div>
        {sel && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
            <span className="size-2 rounded-full" style={{ background: sel.tint }} />
            <span className="font-medium">{sel.label}</span>
            <span className="tabular-nums text-white/70">
              {sel.duration.toFixed(1)} s{ed.selected.length > 1 ? ` · +${ed.selected.length - 1}` : ""}
            </span>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

