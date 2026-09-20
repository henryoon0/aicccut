/**
 * Sticky track header: name, mute / solo / lock chips, visibility eye and the
 * 44 ↔ 76 px height toggle. Mute, lock and hide are document state; solo and
 * the row height are view-only.
 */
import { HugeiconsIcon } from "@hugeicons/react";
import { MusicNote01Icon, SparklesIcon, TextIcon, Video01Icon, ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { Tooltip } from "#/components/ui/tooltip";
import { useActions } from "#/editor/core";
import type { Track, TrackKind } from "#/editor/core";
import { cn } from "#/lib/utils";
import { HEADER_W } from "./geometry";

const KIND_ICON: Record<TrackKind, typeof Video01Icon> = {
  video: Video01Icon,
  audio: MusicNote01Icon,
  text: TextIcon,
  effect: SparklesIcon,
};

/** Track kind as shown in the expanded header row. */
const KIND_LABEL: Record<TrackKind, string> = {
  video: "비디오",
  audio: "오디오",
  text: "텍스트",
  effect: "효과",
};

export function KindIcon({ kind, size = 14 }: { kind: TrackKind; size?: number }) {
  return <HugeiconsIcon icon={KIND_ICON[kind]} size={size} strokeWidth={1.5} />;
}

export function TrackHeader({
  track,
  tall,
  solo,
  clips,
  onTall,
  onSolo,
}: {
  track: Track;
  tall: boolean;
  solo: boolean;
  clips: number;
  onTall: () => void;
  onSolo: () => void;
}) {
  const actions = useActions();

  const chip = (label: string, on: boolean, tip: string, onClick: () => void, cls?: string) => (
    <Tooltip content={tip} key={label}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        className={cn(
          "grid size-5 place-items-center rounded-sm text-[10px] font-semibold transition-colors duration-100 hover:bg-hover focus-visible:ring-1 focus-visible:ring-focus-ring",
          on ? cls ?? "bg-selected text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </button>
    </Tooltip>
  );

  return (
    <div
      className={cn(
        "sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-1 border-r border-border bg-surface-3 px-2",
        (track.hidden || track.muted) && "opacity-60",
      )}
      style={{ width: HEADER_W }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">
          <KindIcon kind={track.kind} />
        </span>
        <span className="truncate text-[12px] font-medium">{track.name}</span>
        <div className="ml-auto flex items-center gap-0.5">
          {chip("M", track.muted, "음소거", () => actions.toggleTrack(track.id, "muted"), "bg-destructive-light text-destructive")}
          {chip("S", solo, "솔로 (보기 전용)", onSolo)}
          {chip("L", track.locked, "잠금", () => actions.toggleTrack(track.id, "locked"))}
          <Tooltip content={track.hidden ? "보이기" : "숨기기"}>
            <button
              type="button"
              aria-label={track.hidden ? "트랙 보이기" : "트랙 숨기기"}
              onClick={() => actions.toggleTrack(track.id, "hidden")}
              className="grid size-5 place-items-center rounded-sm text-muted-foreground hover:bg-hover hover:text-foreground"
            >
              <HugeiconsIcon icon={track.hidden ? ViewOffIcon : ViewIcon} size={12} strokeWidth={1.5} />
            </button>
          </Tooltip>
        </div>
      </div>
      {tall && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{KIND_LABEL[track.kind]}</span>
          <span>·</span>
          <span>클립 {clips}개</span>
        </div>
      )}
      <button
        type="button"
        onClick={onTall}
        aria-label={tall ? "트랙 접기" : "트랙 펼치기"}
        className="absolute bottom-0 right-1 text-[9px] leading-none text-muted-foreground hover:text-foreground"
      >
        {tall ? "▴" : "▾"}
      </button>
    </div>
  );
}
