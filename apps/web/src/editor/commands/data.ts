/**
 * Presentation data for the command surfaces: an icon per command, the one
 * line that teaches what it does, and the tiny word printed on its key cap.
 *
 * Keyed by the ids in `COMMAND_LIST`. Everything else (labels, groups,
 * shortcuts, enablement, group headings) comes from core; nothing is
 * duplicated here.
 */
import {
  Bookmark, ChevronsLeft, ChevronsRight, CircleX, Command, Copy, Eraser, FastForward, FilePlus,
  Flag, FlagTriangleRight, FolderOpen, Frame, Grid2x2, Keyboard, Magnet, Maximize2, PanelLeft,
  PanelRight, Pause, Play, Redo2, Repeat, Rewind, Ruler, Scan, Scissors, Share2, SkipBack,
  SkipForward, Sparkles, SquareDashed, StepBack, StepForward, Trash2, Type, Undo2, VolumeX, Waves,
  X, ZoomIn, ZoomOut, type LucideIcon,
} from "lucide-react";
import { GROUP_LABELS } from "#/editor/core";

export const COMMAND_ICONS: Record<string, LucideIcon> = {
  split: Scissors, delete: Trash2, "ripple-delete": Eraser, ripple: Waves, undo: Undo2, redo: Redo2,
  duplicate: Copy, "mute-clip": VolumeX, "trim-start-to-playhead": ChevronsLeft,
  "trim-end-to-playhead": ChevronsRight, "select-all": SquareDashed, deselect: X,
  play: Play, "prev-frame": StepBack, "next-frame": StepForward, "prev-10-frames": Rewind,
  "next-10-frames": FastForward, "goto-start": SkipBack, "goto-end": SkipForward,
  "shuttle-back": Rewind, "shuttle-stop": Pause, "shuttle-forward": FastForward,
  "toggle-loop": Repeat, "set-in": Flag, "set-out": FlagTriangleRight, "clear-in-out": CircleX,
  "add-text": Type, "add-effect": Sparkles, bookmark: Bookmark,
  import: FolderOpen, export: Share2, new: FilePlus,
  "zoom-in": ZoomIn, "zoom-out": ZoomOut, fit: Maximize2, "zoom-overview": ZoomOut,
  "zoom-normal": Ruler, "zoom-detail": ZoomIn, "zoom-frames": Scan, "toggle-snap": Magnet,
  "safe-areas": Frame, "toggle-grid": Grid2x2, "toggle-media-panel": PanelLeft,
  "toggle-inspector": PanelRight, "open-palette": Command, "open-shortcuts": Keyboard,
};

/** One line on what the command does, for the teaching surfaces. */
export const COMMAND_HINTS: Record<string, string> = {
  split: "재생 헤드 위치에서 클립을 둘로 나눕니다",
  delete: "선택한 클립을 삭제합니다",
  "ripple-delete": "선택한 클립을 삭제하고 빈자리를 메웁니다",
  ripple: "삭제하거나 트림할 때 빈자리를 자동으로 메웁니다",
  undo: "마지막 변경을 되돌립니다",
  redo: "되돌린 변경을 다시 적용합니다",
  duplicate: "선택한 클립을 그 자리에 복제합니다",
  "mute-clip": "선택한 클립의 소리를 끄거나 다시 켭니다",
  "trim-start-to-playhead": "클립의 시작점을 재생 헤드까지 당깁니다",
  "trim-end-to-playhead": "클립의 끝점을 재생 헤드까지 당깁니다",
  "select-all": "타임라인의 모든 클립을 선택합니다",
  deselect: "선택을 해제하거나 열린 창을 닫습니다",
  play: "재생을 시작하거나 멈춥니다",
  "prev-frame": "재생 헤드를 1프레임 뒤로 옮깁니다",
  "next-frame": "재생 헤드를 1프레임 앞으로 옮깁니다",
  "prev-10-frames": "10프레임 뒤로 이동합니다",
  "next-10-frames": "10프레임 앞으로 이동합니다",
  "goto-start": "재생 헤드를 00:00으로 옮깁니다",
  "goto-end": "재생 헤드를 마지막 프레임으로 옮깁니다",
  "shuttle-back": "거꾸로 재생합니다. 다시 누르면 더 빨라집니다",
  "shuttle-stop": "그 자리에서 재생을 멈춥니다",
  "shuttle-forward": "앞으로 재생합니다. 다시 누르면 더 빨라집니다",
  "toggle-loop": "재생 중 시작점과 끝점 사이를 반복합니다",
  "set-in": "재생 헤드 위치를 범위의 시작점으로 표시합니다",
  "set-out": "재생 헤드 위치를 범위의 끝점으로 표시합니다",
  "clear-in-out": "시작점과 끝점 표시를 모두 지웁니다",
  "add-text": "재생 헤드 위치에 텍스트 레이어를 넣습니다",
  "add-effect": "선택한 클립에 넣을 효과를 찾아봅니다",
  bookmark: "이 순간을 눈금자에 표시합니다",
  import: "미디어를 라이브러리로 가져옵니다",
  export: "프로젝트를 파일로 렌더링합니다",
  new: "새 프로젝트를 시작합니다",
  "zoom-in": "시간은 짧게, 더 자세히 봅니다",
  "zoom-out": "타임라인을 더 넓게 봅니다",
  fit: "프로젝트 전체가 보이도록 맞춥니다",
  "zoom-overview": "프로젝트 전체를 한눈에 봅니다",
  "zoom-normal": "작업하기 편한 기본 배율입니다",
  "zoom-detail": "짧은 클립이 보일 만큼 가까이 봅니다",
  "zoom-frames": "프레임 단위로 봅니다",
  "toggle-snap": "클립을 가장자리와 재생 헤드에 달라붙게 합니다",
  "safe-areas": "캔버스에 제목·동작 안전 영역 안내선을 표시합니다",
  "toggle-grid": "캔버스 위에 격자를 표시합니다",
  "toggle-media-panel": "미디어 패널을 보이거나 숨깁니다",
  "toggle-inspector": "속성 패널을 보이거나 숨깁니다",
  "open-palette": "이름으로 아무 명령이나 실행합니다",
  "open-shortcuts": "이 단축키 안내를 엽니다",
};

/** The word printed under a key cap when exactly one command owns the key. */
export const KEY_LABELS: Record<string, string> = {
  split: "분할", delete: "삭제", "ripple-delete": "리플", ripple: "리플", undo: "실행취소",
  redo: "다시실행", duplicate: "복제", "mute-clip": "음소거", "trim-start-to-playhead": "트림",
  "trim-end-to-playhead": "트림", "select-all": "전체", deselect: "해제",
  play: "재생", "prev-frame": "프레임", "next-frame": "프레임", "prev-10-frames": "프레임",
  "next-10-frames": "프레임", "goto-start": "처음", "goto-end": "끝", "shuttle-back": "역재생",
  "shuttle-stop": "정지", "shuttle-forward": "빨리감기", "toggle-loop": "반복", "set-in": "시작점",
  "set-out": "끝점", "clear-in-out": "해제",
  "add-text": "텍스트", "add-effect": "효과", bookmark: "북마크",
  import: "가져오기", export: "내보내기", new: "새로",
  "zoom-in": "확대", "zoom-out": "축소", fit: "맞춤", "zoom-overview": "배율", "zoom-normal": "배율",
  "zoom-detail": "배율", "zoom-frames": "배율", "toggle-snap": "스냅", "safe-areas": "안전영역",
  "toggle-grid": "격자", "toggle-media-panel": "미디어", "toggle-inspector": "속성",
  "open-palette": "명령", "open-shortcuts": "단축키",
};

/** The heading a group id prints under; core owns the Korean words. */
export function groupLabel(group: string): string {
  return (GROUP_LABELS as Record<string, string>)[group] ?? group;
}
