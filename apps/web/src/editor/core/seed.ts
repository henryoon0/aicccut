/**
 * Realistic seed data and display helpers, copied from the prototype mock so
 * the prototypes folder can be deleted. `seedIfEmpty()` in persistence.ts
 * writes these into localStorage on first run.
 */
import type { Asset, Clip, ClipProps, Fps, Project, TextStyle, Track } from "./types";
import { BLEND_MODES } from "./types";

export { BLEND_MODES };

export const DEFAULT_FPS: Fps = 30;

/** Canvas pixel sizes per aspect ratio. */
export const ASPECT_SIZES: Record<Project["aspect"], { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

/** Tints handed to new projects and assets, in rotation. */
export const TINTS = ["#5b6cff", "#ff6b6b", "#2ec4b6", "#f4a261", "#8d99ae", "#c77dff", "#3a86ff", "#06d6a0", "#ffd166", "#ef476f"];

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: "Pretendard",
  size: 96,
  weight: 700,
  italic: false,
  tracking: -2,
  leading: 120,
  color: "#FFFFFF",
  align: "center",
};

/** Fresh props for a clip with nothing animated or applied. */
export function defaultClipProps(): ClipProps {
  return { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100, blend: "Normal", effects: [], keyframes: {} };
}

/** Tracks every new project starts with (top to bottom). */
export function defaultTracks(): Track[] {
  return [
    { id: "t-text", name: "텍스트", kind: "text", muted: false, locked: false, hidden: false },
    { id: "t-fx", name: "효과", kind: "effect", muted: false, locked: false, hidden: false },
    { id: "t-v2", name: "비디오 2", kind: "video", muted: false, locked: false, hidden: false },
    { id: "t-v1", name: "비디오 1", kind: "video", muted: false, locked: false, hidden: false },
    { id: "t-a1", name: "음성", kind: "audio", muted: false, locked: false, hidden: false },
    { id: "t-a2", name: "음악", kind: "audio", muted: false, locked: false, hidden: false },
  ];
}

export const PROJECTS: Project[] = [
  { id: "p1", name: "Claude Code 강의 6화 — 훅과 에이전트", aspect: "16:9", fps: 30, width: 1920, height: 1080, createdAt: "2026-09-10T10:00:00+09:00", updatedAt: "2026-09-19T09:12:00+09:00", tint: "#5b6cff" },
  { id: "p2", name: "Threads 릴스 · 프롬프트 3줄 요약", aspect: "9:16", fps: 30, width: 1080, height: 1920, createdAt: "2026-09-18T20:00:00+09:00", updatedAt: "2026-09-18T22:40:00+09:00", tint: "#ff6b6b" },
  { id: "p3", name: "LG U+ 임원 특강 하이라이트", aspect: "16:9", fps: 24, width: 3840, height: 2160, createdAt: "2026-09-16T09:00:00+09:00", updatedAt: "2026-09-17T15:03:00+09:00", tint: "#2ec4b6" },
  { id: "p4", name: "바이브코딩 7기 소개 영상", aspect: "1:1", fps: 30, width: 1080, height: 1080, createdAt: "2026-09-14T13:00:00+09:00", updatedAt: "2026-09-15T11:30:00+09:00", tint: "#f4a261" },
  { id: "p5", name: "OBS 세팅 튜토리얼 (미완)", aspect: "16:9", fps: 60, width: 1920, height: 1080, createdAt: "2026-09-11T18:00:00+09:00", updatedAt: "2026-09-12T19:48:00+09:00", tint: "#8d99ae" },
  { id: "p6", name: "수강생 후기 모음 v2", aspect: "4:5", fps: 30, width: 1080, height: 1350, createdAt: "2026-09-07T08:00:00+09:00", updatedAt: "2026-09-08T08:20:00+09:00", tint: "#c77dff" },
];

export const ASSETS: Asset[] = [
  { id: "a1", name: "intro_camA.mp4", kind: "video", duration: 184.2, width: 3840, height: 2160, fps: 30, size: 2_431_000_000, tint: "#3a86ff", addedAt: "2026-09-19T08:50:00+09:00" },
  { id: "a2", name: "intro_camB.mp4", kind: "video", duration: 184.4, width: 1920, height: 1080, fps: 30, size: 912_000_000, tint: "#4361ee", addedAt: "2026-09-19T08:50:00+09:00" },
  { id: "a3", name: "screen_hooks_demo.mov", kind: "video", duration: 612.0, width: 2880, height: 1800, fps: 60, size: 4_120_000_000, tint: "#7209b7", addedAt: "2026-09-19T08:52:00+09:00" },
  { id: "a4", name: "screen_agent_loop.mov", kind: "video", duration: 388.5, width: 2880, height: 1800, fps: 60, size: 2_760_000_000, tint: "#560bad", addedAt: "2026-09-19T08:53:00+09:00" },
  { id: "a5", name: "voiceover_take3.wav", kind: "audio", duration: 1240.0, size: 238_000_000, tint: "#06d6a0", addedAt: "2026-09-19T09:01:00+09:00" },
  { id: "a6", name: "bgm_lofi_loop.mp3", kind: "audio", duration: 214.0, size: 5_100_000, tint: "#118ab2", addedAt: "2026-09-18T20:11:00+09:00" },
  { id: "a7", name: "sfx_click.wav", kind: "audio", duration: 0.4, size: 82_000, tint: "#073b4c", addedAt: "2026-09-18T20:11:00+09:00" },
  { id: "a8", name: "aicc_logo.png", kind: "image", duration: 0, width: 1024, height: 1024, size: 212_000, tint: "#ffd166", addedAt: "2026-09-10T10:00:00+09:00" },
  { id: "a9", name: "slide_hooks_01.png", kind: "image", duration: 0, width: 1920, height: 1080, size: 1_340_000, tint: "#ef476f", addedAt: "2026-09-19T08:55:00+09:00" },
  { id: "a10", name: "slide_hooks_02.png", kind: "image", duration: 0, width: 1920, height: 1080, size: 1_280_000, tint: "#f78c6b", addedAt: "2026-09-19T08:55:00+09:00" },
  { id: "a11", name: "broll_keyboard.mp4", kind: "video", duration: 22.6, width: 3840, height: 2160, fps: 24, size: 402_000_000, tint: "#8338ec", addedAt: "2026-09-17T14:20:00+09:00" },
  { id: "a12", name: "broll_desk_pan.mp4", kind: "video", duration: 15.1, width: 3840, height: 2160, fps: 24, size: 288_000_000, tint: "#ff006e", addedAt: "2026-09-17T14:20:00+09:00" },
];

export const TRACKS: Track[] = defaultTracks();

const P = defaultClipProps;
const text = (content: string): ClipProps => ({ ...P(), text: { ...DEFAULT_TEXT_STYLE, content } });

export const CLIPS: Clip[] = [
  { id: "c1", trackId: "t-v1", assetId: "a1", label: "intro_camA", start: 0, duration: 12.4, inPoint: 3.2, tint: "#3a86ff", props: P() },
  { id: "c2", trackId: "t-v1", assetId: "a3", label: "screen_hooks_demo", start: 12.4, duration: 41.0, inPoint: 20.0, tint: "#7209b7", props: P() },
  { id: "c3", trackId: "t-v1", assetId: "a2", label: "intro_camB", start: 53.4, duration: 8.6, inPoint: 56.6, tint: "#4361ee", props: P() },
  { id: "c4", trackId: "t-v1", assetId: "a4", label: "screen_agent_loop", start: 62.0, duration: 36.0, inPoint: 0, tint: "#560bad", props: P() },
  { id: "c5", trackId: "t-v2", assetId: "a11", label: "broll_keyboard", start: 14.0, duration: 6.2, inPoint: 2.0, tint: "#8338ec", props: P() },
  {
    id: "c6", trackId: "t-v2", assetId: "a9", label: "slide_hooks_01", start: 30.0, duration: 9.0, inPoint: 0, tint: "#ef476f",
    // "slide in from left + fade + unblur" so the preview moves on first play.
    props: {
      ...P(),
      keyframes: {
        x: [{ id: "k1", time: 0, value: -420, easing: "ease-out" }, { id: "k2", time: 0.9, value: 0, easing: "linear" }],
        opacity: [
          { id: "k3", time: 0, value: 0, easing: "ease-out" }, { id: "k4", time: 0.7, value: 100, easing: "linear" },
          { id: "k5", time: 8.2, value: 100, easing: "ease-in" }, { id: "k6", time: 9, value: 0, easing: "linear" },
        ],
        scale: [{ id: "k7", time: 0, value: 88, easing: "spring" }, { id: "k8", time: 1.1, value: 100, easing: "linear" }],
        blur: [{ id: "k9", time: 0, value: 18, easing: "ease-out" }, { id: "k10", time: 0.8, value: 0, easing: "linear" }],
      },
    },
  },
  { id: "c7", trackId: "t-v2", assetId: "a12", label: "broll_desk_pan", start: 66.5, duration: 5.4, inPoint: 1.0, tint: "#ff006e", props: P() },
  { id: "c8", trackId: "t-a1", assetId: "a5", label: "voiceover_take3", start: 0, duration: 98.0, inPoint: 12.0, tint: "#06d6a0", props: P() },
  { id: "c9", trackId: "t-a2", assetId: "a6", label: "bgm_lofi_loop", start: 0, duration: 98.0, inPoint: 0, tint: "#118ab2", props: P() },
  { id: "c10", trackId: "t-text", label: "훅(Hook)이란 무엇인가", start: 2.0, duration: 6.0, inPoint: 0, tint: "#ffd166", props: text("훅(Hook)이란 무엇인가") },
  { id: "c11", trackId: "t-text", label: "PreToolUse · PostToolUse", start: 22.0, duration: 8.0, inPoint: 0, tint: "#ffd166", props: text("PreToolUse · PostToolUse") },
  {
    id: "c12", trackId: "t-fx", label: "블러 12px", start: 12.4, duration: 3.0, inPoint: 0, tint: "#94a3b8",
    props: { ...P(), effects: [{ id: "e1", type: "blur", enabled: true, params: { amount: 12 } }] },
  },
];

export const PROJECT_DURATION = 98;

export const FONTS = [
  "Inter", "Pretendard", "Noto Sans KR", "Playfair Display", "Space Grotesk", "IBM Plex Sans", "IBM Plex Mono",
  "Gothic A1", "Nanum Myeongjo", "DM Sans", "Fraunces", "JetBrains Mono", "Manrope", "Lora", "Sora", "Outfit",
  "Bricolage Grotesque", "Instrument Serif", "Geist", "Geist Mono", "Nanum Gothic", "Black Han Sans", "Do Hyeon",
  "Jua", "Gowun Dodum", "Gowun Batang", "Hahmlet", "Song Myung", "Sunflower", "Poor Story",
];

export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
export const WEIGHT_LABEL: Record<number, string> = {
  100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium",
  600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black",
};
export const TEXT_SWATCHES = ["#FFFFFF", "#0A0A0A", "#FFD166", "#5B6CFF", "#FF6B6B", "#2EC4B6", "#F4A261", "#C77DFF"];

/** Effect catalogue for browsers/menus. `chroma` and `lut` are listed but not yet applicable. */
export const EFFECTS = [
  { id: "blur", name: "블러", description: "가우시안 블러, 0~64px" },
  { id: "brightness", name: "밝기", description: "-100 ~ +100" },
  { id: "contrast", name: "대비", description: "0~200%" },
  { id: "saturation", name: "채도", description: "0~200%" },
  { id: "vignette", name: "비네트", description: "가장자리 어둡게" },
  { id: "chroma", name: "크로마 키", description: "특정 색 제거" },
  { id: "lut", name: "LUT", description: ".cube 파일로 색 보정" },
  { id: "sharpen", name: "선명도", description: "0~100" },
] as const;

/** Mock command table kept for reference; the live registry is commands.ts. */
export const COMMANDS = [
  { id: "split", label: "재생 헤드에서 클립 분할", shortcut: "S", group: "Edit" },
  { id: "delete", label: "선택한 클립 삭제", shortcut: "Backspace", group: "Edit" },
  { id: "ripple", label: "리플 편집 켜기/끄기", shortcut: "R", group: "Edit" },
  { id: "undo", label: "실행 취소", shortcut: "Mod+Z", group: "Edit" },
  { id: "redo", label: "다시 실행", shortcut: "Mod+Shift+Z", group: "Edit" },
  { id: "play", label: "재생 / 일시정지", shortcut: "Space", group: "Playback" },
  { id: "prev-frame", label: "이전 프레임", shortcut: "ArrowLeft", group: "Playback" },
  { id: "next-frame", label: "다음 프레임", shortcut: "ArrowRight", group: "Playback" },
  { id: "goto-start", label: "처음으로", shortcut: "Home", group: "Playback" },
  { id: "add-text", label: "텍스트 추가", shortcut: "T", group: "Insert" },
  { id: "add-effect", label: "효과 추가…", shortcut: "E", group: "Insert" },
  { id: "import", label: "미디어 가져오기…", shortcut: "Mod+I", group: "File" },
  { id: "export", label: "내보내기…", shortcut: "Mod+E", group: "File" },
  { id: "new", label: "새 프로젝트", shortcut: "Mod+N", group: "File" },
  { id: "zoom-in", label: "타임라인 확대", shortcut: "=", group: "View" },
  { id: "zoom-out", label: "타임라인 축소", shortcut: "-", group: "View" },
  { id: "fit", label: "타임라인 맞춤", shortcut: "Shift+Z", group: "View" },
  { id: "toggle-snap", label: "스냅 켜기/끄기", shortcut: "N", group: "View" },
  { id: "safe-areas", label: "안전 영역 표시/숨기기", shortcut: "Mod+'", group: "View" },
  { id: "bookmark", label: "북마크 추가", shortcut: "B", group: "Insert" },
] as const;

/** 00:01:23.04 style timecode. */
export function timecode(seconds: number, fps = 30): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const f = Math.floor((s - Math.floor(s)) * fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}.${pad(f)}`;
}

/** "1분 24초" style short duration (Korean units, no space before the unit). */
export function shortDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}초`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}분 ${s}초`;
  const h = Math.floor(m / 60);
  return `${h}시간 ${m % 60}분`;
}

/** "1.3 MB" style file size. */
export function fileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(0)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

/** "3시간 전" style relative time in Korean. */
export function relativeTime(iso: string, now = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}분 전`;
  if (diff < 86400) return `${Math.round(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

/** Parse "hh:mm:ss.ff", "mm:ss", "ss" or a bare frame count with 'f' suffix. Returns null when unparseable. */
export function parseTimecode(input: string, fps = 30): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+f$/i.test(s)) return Number(s.slice(0, -1)) / fps;
  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || Number.isNaN(Number(p.replace(".", ""))))) return null;
  let sec = 0;
  const lastRaw = parts.pop() ?? "0";
  const [secPart, framePart] = lastRaw.split(".");
  sec += Number(secPart);
  if (framePart !== undefined) sec += Number(framePart.padEnd(2, "0").slice(0, 2)) / fps;
  let mult = 60;
  while (parts.length) {
    sec += Number(parts.pop()) * mult;
    mult *= 60;
  }
  return Math.max(0, sec);
}
