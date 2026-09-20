/**
 * Command registry: one table drives the palette, the shortcut cheatsheet
 * and the global key listener. Commands receive a `CommandContext` and may
 * return a short status string for a toast.
 */
import { useEffect, useMemo } from "react";
import type { Actions } from "./actions";
import { useEditorContext } from "./context";
import { documentDuration } from "./document";
import { timecode } from "./seed";
import { hasModifier, isEditableTarget, matchesShortcut, parseShortcut, shortcutSpecificity } from "./shortcuts";
import type { EditorStore, UiState } from "./store";
import type { TimeStore } from "./time-store";
import type { Transport } from "./transport";

export type CommandGroup = "Edit" | "Playback" | "Insert" | "File" | "View";
export const GROUP_ORDER: CommandGroup[] = ["Edit", "Playback", "Insert", "File", "View"];
/** Display names for `CommandGroup`; the union values stay as stable ids. */
export const GROUP_LABELS: Record<CommandGroup, string> = { Edit: "편집", Playback: "재생", Insert: "삽입", File: "파일", View: "보기" };

/** Small facade over the `uiPanels` slice for commands. */
export interface UiApi {
  get(): UiState;
  set(patch: Partial<UiState>): void;
  toggle(key: Parameters<Actions["toggleUi"]>[0]): void;
  openDialog(dialog: NonNullable<UiState["dialog"]>): void;
  closeDialog(): void;
}

export interface CommandContext {
  store: EditorStore;
  actions: Actions;
  time: TimeStore;
  transport: Transport;
  ui: UiApi;
}

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  /** Primary shortcut, e.g. "Mod+Z", "S", "Space", "ArrowLeft". */
  shortcut?: string;
  /** Extra combos that also trigger the command (not shown in menus). */
  altShortcuts?: string[];
  keywords?: string[];
  /** Runs the command; an optional return string is a toast message. */
  run(ctx: CommandContext): string | void;
  enabled?(ctx: CommandContext): boolean;
}

/** Timeline zoom presets in px/s. */
export const ZOOM_PRESETS = [
  { id: "zoom-overview", label: "타임라인 배율: 전체 보기", pps: 5, shortcut: "Alt+1" },
  { id: "zoom-normal", label: "타임라인 배율: 보통", pps: 20, shortcut: "Alt+2" },
  { id: "zoom-detail", label: "타임라인 배율: 자세히", pps: 80, shortcut: "Alt+3" },
  { id: "zoom-frames", label: "타임라인 배율: 프레임 단위", pps: 300, shortcut: "Alt+4" },
];

const hasSelection = (ctx: CommandContext) => ctx.store.getState().selection.clipIds.length > 0;
const tc = (ctx: CommandContext) => timecode(ctx.time.get(), ctx.store.getState().doc.project.fps);
const primary = (ctx: CommandContext) => {
  const ids = ctx.store.getState().selection.clipIds;
  return ids[ids.length - 1];
};

/** Toast texts shared by more than one command. */
const MSG = {
  nothingAtPlayhead: "재생 헤드 위치에 클립이 없습니다",
  deleted: "삭제됨",
  deletedGapClosed: "삭제됨 · 빈 공간 메움",
};

export const COMMAND_LIST: Command[] = [
  // ── Edit ──
  { id: "split", label: "재생 헤드에서 클립 분할", shortcut: "S", group: "Edit", keywords: ["split", "cut", "razor", "blade", "분할", "자르기", "컷"],
    run: (ctx) => (ctx.actions.splitClips(undefined, ctx.time.get()).length ? `${tc(ctx)}에서 분할` : MSG.nothingAtPlayhead) },
  { id: "delete", label: "선택한 클립 삭제", shortcut: "Backspace", altShortcuts: ["Delete"], group: "Edit", keywords: ["delete", "remove", "trash", "삭제", "지우기"], enabled: hasSelection,
    run: (ctx) => { ctx.actions.deleteClips(); return ctx.store.getState().ripple ? MSG.deletedGapClosed : MSG.deleted; } },
  { id: "ripple-delete", label: "선택한 클립 리플 삭제", shortcut: "Shift+Backspace", altShortcuts: ["Shift+Delete"], group: "Edit", keywords: ["ripple delete", "close gap", "리플 삭제", "빈 공간"], enabled: hasSelection,
    run: (ctx) => { ctx.actions.deleteClips(undefined, true); return MSG.deletedGapClosed; } },
  { id: "ripple", label: "리플 편집 켜기/끄기", shortcut: "R", group: "Edit", keywords: ["ripple", "gap", "close", "리플", "빈 공간"],
    run: (ctx) => { ctx.actions.toggleRipple(); return `리플 편집 ${ctx.store.getState().ripple ? "켬" : "꺼짐"}`; } },
  { id: "undo", label: "실행 취소", shortcut: "Mod+Z", group: "Edit", keywords: ["undo", "실행 취소", "되돌리기"], enabled: (ctx) => ctx.store.canUndo(),
    run: (ctx) => { ctx.actions.undo(); return "실행 취소"; } },
  { id: "redo", label: "다시 실행", shortcut: "Mod+Shift+Z", altShortcuts: ["Mod+Y"], group: "Edit", keywords: ["redo", "다시 실행"], enabled: (ctx) => ctx.store.canRedo(),
    run: (ctx) => { ctx.actions.redo(); return "다시 실행"; } },
  { id: "duplicate", label: "클립 복제", shortcut: "Mod+D", group: "Edit", keywords: ["duplicate", "copy", "복제", "복사"], enabled: hasSelection,
    run: (ctx) => { ctx.actions.duplicateClip(); return "복제됨"; } },
  { id: "mute-clip", label: "클립 음소거 / 해제", shortcut: "Shift+M", group: "Edit", keywords: ["mute", "silence", "audio", "음소거", "소리", "오디오"], enabled: hasSelection,
    run: (ctx) => { ctx.actions.toggleClipsMuted(); return "음소거 전환됨"; } },
  { id: "trim-start-to-playhead", label: "시작점을 재생 헤드로", shortcut: "[", group: "Edit", keywords: ["trim", "in", "트림", "시작점", "앞 자르기"], enabled: hasSelection,
    run: (ctx) => { const id = primary(ctx); if (id) ctx.actions.trimToTime(id, "start", ctx.time.get()); return `시작점을 ${tc(ctx)}에 맞춤`; } },
  { id: "trim-end-to-playhead", label: "끝점을 재생 헤드로", shortcut: "]", group: "Edit", keywords: ["trim", "out", "트림", "끝점", "뒤 자르기"], enabled: hasSelection,
    run: (ctx) => { const id = primary(ctx); if (id) ctx.actions.trimToTime(id, "end", ctx.time.get()); return `끝점을 ${tc(ctx)}에 맞춤`; } },
  { id: "select-all", label: "모든 클립 선택", shortcut: "Mod+A", group: "Edit", keywords: ["select all", "전체 선택", "모두 선택"], run: (ctx) => { ctx.actions.selectAll(); } },
  { id: "deselect", label: "선택 해제", shortcut: "Escape", group: "Edit", keywords: ["clear selection", "deselect", "선택 해제"],
    run: (ctx) => { if (ctx.ui.get().dialog) ctx.ui.closeDialog(); else ctx.actions.clearSelection(); } },

  // ── Playback ──
  { id: "play", label: "재생 / 일시정지", shortcut: "Space", group: "Playback", keywords: ["play", "pause", "stop", "재생", "일시정지", "정지"],
    run: (ctx) => { ctx.transport.toggle(); return ctx.transport.getState().playing ? "재생 중" : `${tc(ctx)}에서 일시정지`; } },
  { id: "prev-frame", label: "이전 프레임", shortcut: "ArrowLeft", group: "Playback", keywords: ["previous frame", "프레임"], run: (ctx) => { ctx.transport.stepFrames(-1); } },
  { id: "next-frame", label: "다음 프레임", shortcut: "ArrowRight", group: "Playback", keywords: ["next frame", "프레임"], run: (ctx) => { ctx.transport.stepFrames(1); } },
  { id: "prev-10-frames", label: "10프레임 뒤로", shortcut: "Shift+ArrowLeft", group: "Playback", keywords: ["back 10 frames", "프레임", "뒤로"], run: (ctx) => { ctx.transport.stepFrames(-10); } },
  { id: "next-10-frames", label: "10프레임 앞으로", shortcut: "Shift+ArrowRight", group: "Playback", keywords: ["forward 10 frames", "프레임", "앞으로"], run: (ctx) => { ctx.transport.stepFrames(10); } },
  { id: "goto-start", label: "처음으로", shortcut: "Home", group: "Playback", keywords: ["go to start", "처음", "시작"], run: (ctx) => { ctx.transport.goToStart(); } },
  { id: "goto-end", label: "끝으로", shortcut: "End", group: "Playback", keywords: ["go to end", "끝", "마지막"], run: (ctx) => { ctx.transport.goToEnd(); } },
  { id: "shuttle-back", label: "뒤로 재생 (J)", shortcut: "J", group: "Playback", keywords: ["shuttle", "jkl", "reverse", "셔틀", "역재생", "되감기"],
    run: (ctx) => { ctx.transport.shuttle(-1); return `${ctx.transport.getState().rate}×`; } },
  { id: "shuttle-stop", label: "정지 (K)", shortcut: "K", group: "Playback", keywords: ["stop", "jkl", "셔틀", "정지"], run: (ctx) => { ctx.transport.pause(); } },
  { id: "shuttle-forward", label: "앞으로 재생 (L)", shortcut: "L", group: "Playback", keywords: ["shuttle", "jkl", "fast", "셔틀", "빨리 감기"],
    run: (ctx) => { ctx.transport.shuttle(1); return `${ctx.transport.getState().rate}×`; } },
  { id: "toggle-loop", label: "반복 재생 켜기/끄기", shortcut: "Alt+L", group: "Playback", keywords: ["loop", "반복"],
    run: (ctx) => { ctx.transport.toggleLoop(); return `반복 재생 ${ctx.transport.getState().loop ? "켬" : "꺼짐"}`; } },
  { id: "set-in", label: "시작점 지정", shortcut: "Shift+I", group: "Playback", keywords: ["in point", "range", "mark", "시작점", "범위", "인"],
    run: (ctx) => { ctx.transport.setIn(ctx.time.get()); return `시작점 ${tc(ctx)}`; } },
  { id: "set-out", label: "끝점 지정", shortcut: "Shift+O", group: "Playback", keywords: ["out point", "range", "mark", "끝점", "범위", "아웃"],
    run: (ctx) => { ctx.transport.setOut(ctx.time.get()); return `끝점 ${tc(ctx)}`; } },
  { id: "clear-in-out", label: "시작점 / 끝점 지우기", shortcut: "Alt+X", group: "Playback", keywords: ["clear in out", "range", "시작점", "끝점", "범위 해제"], run: (ctx) => { ctx.transport.clearInOut(); } },

  // ── Insert ──
  { id: "add-text", label: "텍스트 추가", shortcut: "T", group: "Insert", keywords: ["text", "title", "caption", "텍스트", "제목", "자막", "글자"],
    run: (ctx) => { ctx.actions.addTextClip(ctx.time.get()); return `${tc(ctx)}에 텍스트 추가`; } },
  { id: "add-effect", label: "효과 추가…", shortcut: "E", group: "Insert", keywords: ["effect", "filter", "blur", "효과", "필터", "블러"], enabled: hasSelection,
    run: (ctx) => { ctx.ui.openDialog("effects"); } },
  { id: "bookmark", label: "북마크 추가", shortcut: "B", group: "Insert", keywords: ["bookmark", "marker", "북마크", "마커", "표시"],
    run: (ctx) => { ctx.actions.addBookmark(ctx.time.get()); return `${tc(ctx)}에 북마크 추가`; } },

  // ── File ──
  { id: "import", label: "미디어 가져오기…", shortcut: "Mod+I", group: "File", keywords: ["import", "open", "media", "file", "가져오기", "불러오기", "미디어", "파일"], run: (ctx) => { ctx.ui.openDialog("import"); } },
  { id: "export", label: "내보내기…", shortcut: "Mod+E", group: "File", keywords: ["export", "render", "save", "mp4", "내보내기", "렌더링", "저장"], run: (ctx) => { ctx.ui.openDialog("export"); } },
  { id: "new", label: "새 프로젝트", shortcut: "Mod+N", group: "File", keywords: ["new project", "새 프로젝트", "프로젝트 만들기"], run: (ctx) => { ctx.ui.openDialog("new-project"); } },

  // ── View ──
  { id: "zoom-in", label: "타임라인 확대", shortcut: "=", altShortcuts: ["Mod+="], group: "View", keywords: ["zoom in", "확대"], run: (ctx) => { ctx.actions.zoomBy(1.25); } },
  { id: "zoom-out", label: "타임라인 축소", shortcut: "-", altShortcuts: ["Mod+-"], group: "View", keywords: ["zoom out", "축소"], run: (ctx) => { ctx.actions.zoomBy(1 / 1.25); } },
  { id: "fit", label: "타임라인 맞춤", shortcut: "Shift+Z", group: "View", keywords: ["fit", "zoom", "all", "맞춤", "전체"],
    run: (ctx) => { ctx.actions.zoomToFit(); return "타임라인을 창에 맞춤"; } },
  ...ZOOM_PRESETS.map<Command>((z) => ({ id: z.id, label: z.label, shortcut: z.shortcut, group: "View", keywords: ["zoom", "확대", "배율"], run: (ctx) => { ctx.actions.setZoomPps(z.pps); } })),
  { id: "toggle-snap", label: "스냅 켜기/끄기", shortcut: "N", group: "View", keywords: ["snap", "snapping", "magnet", "스냅", "자석", "붙이기"],
    run: (ctx) => { ctx.actions.toggleSnapping(); return `스냅 ${ctx.store.getState().snapping ? "켬" : "꺼짐"}`; } },
  { id: "safe-areas", label: "안전 영역 표시/숨기기", shortcut: "Mod+'", group: "View", keywords: ["safe areas", "guides", "title safe", "안전 영역", "가이드"],
    run: (ctx) => { ctx.ui.toggle("safeAreas"); return `안전 영역 ${ctx.ui.get().safeAreas ? "표시됨" : "숨김"}`; } },
  { id: "toggle-grid", label: "격자 표시/숨기기", shortcut: "Mod+;", group: "View", keywords: ["grid", "격자", "그리드"], run: (ctx) => { ctx.ui.toggle("grid"); } },
  { id: "toggle-media-panel", label: "미디어 패널 열기/닫기", shortcut: "M", group: "View", keywords: ["media panel", "library", "assets", "미디어", "라이브러리", "패널"], run: (ctx) => { ctx.ui.toggle("mediaPanel"); } },
  { id: "toggle-inspector", label: "속성 패널 열기/닫기", shortcut: "I", group: "View", keywords: ["inspector", "properties", "속성", "패널"], run: (ctx) => { ctx.ui.toggle("inspector"); } },
  { id: "open-palette", label: "명령 팔레트", shortcut: "Mod+K", group: "View", keywords: ["command palette", "search", "commands", "명령", "검색"], run: (ctx) => { ctx.ui.set({ palette: true }); } },
  { id: "open-shortcuts", label: "단축키", shortcut: "?", group: "View", keywords: ["keyboard shortcuts", "help", "keys", "단축키", "키보드", "도움말"], run: (ctx) => { ctx.ui.toggle("cheatsheet"); } },
];

export const COMMANDS_BY_ID: Record<string, Command> = Object.fromEntries(COMMAND_LIST.map((c) => [c.id, c]));

/** Commands grouped in `GROUP_ORDER`. */
export function commandsByGroup(list: Command[] = COMMAND_LIST): { group: CommandGroup; commands: Command[] }[] {
  return GROUP_ORDER.map((group) => ({ group, commands: list.filter((c) => c.group === group) })).filter((g) => g.commands.length);
}

/** Run a command by id when it exists and is enabled; returns its message. */
export function runCommand(id: string, ctx: CommandContext): string | void {
  const cmd = COMMANDS_BY_ID[id];
  if (!cmd || (cmd.enabled && !cmd.enabled(ctx))) return;
  return cmd.run(ctx);
}

/** Build a CommandContext from the three editor primitives. */
export function createCommandContext(store: EditorStore, time: TimeStore, transport: Transport): CommandContext {
  const a = store.actions;
  return {
    store, actions: a, time, transport,
    ui: { get: () => store.getState().uiPanels, set: a.setUi, toggle: a.toggleUi, openDialog: a.openDialog, closeDialog: a.closeDialog },
  };
}

/** CommandContext for the current EditorProvider (memoised). */
export function useCommandContext(): CommandContext {
  const { store, time, transport } = useEditorContext();
  return useMemo(() => createCommandContext(store, time, transport), [store, time, transport]);
}

interface Bound {
  cmd: Command;
  parsed: ReturnType<typeof parseShortcut>;
  specificity: number;
}

function bind(list: Command[]): Bound[] {
  const out: Bound[] = [];
  for (const cmd of list) {
    for (const s of [cmd.shortcut, ...(cmd.altShortcuts ?? [])]) {
      if (!s) continue;
      const parsed = parseShortcut(s);
      out.push({ cmd, parsed, specificity: shortcutSpecificity(parsed) });
    }
  }
  return out.sort((a, b) => b.specificity - a.specificity);
}

/** The command a keydown triggers (most specific match wins), or undefined. */
export function commandForKey(e: Parameters<typeof matchesShortcut>[0], list: Command[] = COMMAND_LIST): Command | undefined {
  return bind(list).find((b) => matchesShortcut(e, b.parsed))?.cmd;
}

/**
 * One window keydown listener that runs matching commands. Skipped while
 * typing in a field (except modifier combos like Mod+Z are left to the
 * browser too) and while the palette is open. `onMessage` receives toast text.
 */
export function useGlobalShortcuts(ctx: CommandContext, opts?: { commands?: Command[]; onMessage?: (msg: string) => void; enabled?: boolean }): void {
  const list = opts?.commands ?? COMMAND_LIST;
  const onMessage = opts?.onMessage;
  const enabled = opts?.enabled ?? true;
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const bound = bind(list);
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || isEditableTarget(e.target)) return;
      if (ctx.ui.get().palette) return;
      const hit = bound.find((b) => matchesShortcut(e, b.parsed));
      if (!hit) return;
      if (hit.cmd.enabled && !hit.cmd.enabled(ctx)) {
        if (!hasModifier(hit.parsed)) e.preventDefault();
        return;
      }
      e.preventDefault();
      const msg = hit.cmd.run(ctx);
      if (msg && onMessage) onMessage(msg);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx, list, onMessage, enabled]);
}

/** Timeline end for "go to end" style UI; re-exported here so palettes need only this module. */
export const durationOf = (ctx: CommandContext) => documentDuration(ctx.store.getState().doc);
