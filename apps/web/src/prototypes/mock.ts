/**
 * Shared realistic data for every prototype. Variants import from here so the
 * same project, assets and clips appear across steps — henry judges layout
 * and interaction, not content differences.
 */

export interface Project {
  id: string;
  name: string;
  aspect: "16:9" | "9:16" | "1:1" | "4:5";
  fps: 24 | 25 | 30 | 60;
  width: number;
  height: number;
  /** Total duration in seconds. */
  duration: number;
  updatedAt: string;
  /** Solid colour used where a thumbnail would be. */
  tint: string;
  clipCount: number;
}

export const PROJECTS: Project[] = [
  { id: "p1", name: "Claude Code 강의 6화 — 훅과 에이전트", aspect: "16:9", fps: 30, width: 1920, height: 1080, duration: 1263, updatedAt: "2026-09-19T09:12:00+09:00", tint: "#5b6cff", clipCount: 42 },
  { id: "p2", name: "Threads 릴스 · 프롬프트 3줄 요약", aspect: "9:16", fps: 30, width: 1080, height: 1920, duration: 38, updatedAt: "2026-09-18T22:40:00+09:00", tint: "#ff6b6b", clipCount: 9 },
  { id: "p3", name: "LG U+ 임원 특강 하이라이트", aspect: "16:9", fps: 24, width: 3840, height: 2160, duration: 412, updatedAt: "2026-09-17T15:03:00+09:00", tint: "#2ec4b6", clipCount: 27 },
  { id: "p4", name: "바이브코딩 7기 소개 영상", aspect: "1:1", fps: 30, width: 1080, height: 1080, duration: 61, updatedAt: "2026-09-15T11:30:00+09:00", tint: "#f4a261", clipCount: 14 },
  { id: "p5", name: "OBS 세팅 튜토리얼 (미완)", aspect: "16:9", fps: 60, width: 1920, height: 1080, duration: 905, updatedAt: "2026-09-12T19:48:00+09:00", tint: "#8d99ae", clipCount: 33 },
  { id: "p6", name: "수강생 후기 모음 v2", aspect: "4:5", fps: 30, width: 1080, height: 1350, duration: 74, updatedAt: "2026-09-08T08:20:00+09:00", tint: "#c77dff", clipCount: 11 },
];

export type AssetKind = "video" | "audio" | "image";

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  /** Seconds; images have 0. */
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  /** Bytes. */
  size: number;
  tint: string;
  addedAt: string;
}

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

export type TrackKind = "video" | "audio" | "text" | "effect";

export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  muted?: boolean;
  locked?: boolean;
  hidden?: boolean;
}

export interface Clip {
  id: string;
  trackId: string;
  assetId?: string;
  /** Label for text/effect clips. */
  label: string;
  /** Timeline start, seconds. */
  start: number;
  /** Duration on the timeline, seconds. */
  duration: number;
  /** Trim offset into the source, seconds. */
  inPoint: number;
  tint: string;
}

export const TRACKS: Track[] = [
  { id: "t-text", name: "Text", kind: "text" },
  { id: "t-fx", name: "Effects", kind: "effect" },
  { id: "t-v2", name: "Video 2", kind: "video" },
  { id: "t-v1", name: "Video 1", kind: "video" },
  { id: "t-a1", name: "Voice", kind: "audio" },
  { id: "t-a2", name: "Music", kind: "audio", muted: false },
];

export const CLIPS: Clip[] = [
  { id: "c1", trackId: "t-v1", assetId: "a1", label: "intro_camA", start: 0, duration: 12.4, inPoint: 3.2, tint: "#3a86ff" },
  { id: "c2", trackId: "t-v1", assetId: "a3", label: "screen_hooks_demo", start: 12.4, duration: 41.0, inPoint: 20.0, tint: "#7209b7" },
  { id: "c3", trackId: "t-v1", assetId: "a2", label: "intro_camB", start: 53.4, duration: 8.6, inPoint: 56.6, tint: "#4361ee" },
  { id: "c4", trackId: "t-v1", assetId: "a4", label: "screen_agent_loop", start: 62.0, duration: 36.0, inPoint: 0, tint: "#560bad" },
  { id: "c5", trackId: "t-v2", assetId: "a11", label: "broll_keyboard", start: 14.0, duration: 6.2, inPoint: 2.0, tint: "#8338ec" },
  { id: "c6", trackId: "t-v2", assetId: "a9", label: "slide_hooks_01", start: 30.0, duration: 9.0, inPoint: 0, tint: "#ef476f" },
  { id: "c7", trackId: "t-v2", assetId: "a12", label: "broll_desk_pan", start: 66.5, duration: 5.4, inPoint: 1.0, tint: "#ff006e" },
  { id: "c8", trackId: "t-a1", assetId: "a5", label: "voiceover_take3", start: 0, duration: 98.0, inPoint: 12.0, tint: "#06d6a0" },
  { id: "c9", trackId: "t-a2", assetId: "a6", label: "bgm_lofi_loop", start: 0, duration: 98.0, inPoint: 0, tint: "#118ab2" },
  { id: "c10", trackId: "t-text", label: "훅(Hook)이란 무엇인가", start: 2.0, duration: 6.0, inPoint: 0, tint: "#ffd166" },
  { id: "c11", trackId: "t-text", label: "PreToolUse · PostToolUse", start: 22.0, duration: 8.0, inPoint: 0, tint: "#ffd166" },
  { id: "c12", trackId: "t-fx", label: "Blur 12px", start: 12.4, duration: 3.0, inPoint: 0, tint: "#94a3b8" },
];

export const PROJECT_DURATION = 98;

export const FONTS = [
  "Inter", "Pretendard", "Noto Sans KR", "Playfair Display", "Space Grotesk", "IBM Plex Sans", "IBM Plex Mono",
  "Gothic A1", "Nanum Myeongjo", "DM Sans", "Fraunces", "JetBrains Mono", "Manrope", "Lora", "Sora", "Outfit",
  "Bricolage Grotesque", "Instrument Serif", "Geist", "Geist Mono", "Nanum Gothic", "Black Han Sans", "Do Hyeon",
  "Jua", "Gowun Dodum", "Gowun Batang", "Hahmlet", "Song Myung", "Sunflower", "Poor Story",
];

export const BLEND_MODES = ["Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten", "Color Dodge", "Color Burn", "Hard Light", "Soft Light", "Difference", "Exclusion"] as const;

export const EFFECTS = [
  { id: "blur", name: "Blur", description: "Gaussian blur, 0–64px" },
  { id: "brightness", name: "Brightness", description: "-100 to +100" },
  { id: "contrast", name: "Contrast", description: "0–200%" },
  { id: "saturation", name: "Saturation", description: "0–200%" },
  { id: "vignette", name: "Vignette", description: "Edge darkening" },
  { id: "chroma", name: "Chroma Key", description: "Remove a colour" },
  { id: "lut", name: "LUT", description: "Apply a .cube lookup" },
  { id: "sharpen", name: "Sharpen", description: "0–100" },
];

export const COMMANDS = [
  { id: "split", label: "Split clip at playhead", shortcut: "S", group: "Edit" },
  { id: "delete", label: "Delete selection", shortcut: "Backspace", group: "Edit" },
  { id: "ripple", label: "Toggle ripple editing", shortcut: "R", group: "Edit" },
  { id: "undo", label: "Undo", shortcut: "Mod+Z", group: "Edit" },
  { id: "redo", label: "Redo", shortcut: "Mod+Shift+Z", group: "Edit" },
  { id: "play", label: "Play / Pause", shortcut: "Space", group: "Playback" },
  { id: "prev-frame", label: "Previous frame", shortcut: "ArrowLeft", group: "Playback" },
  { id: "next-frame", label: "Next frame", shortcut: "ArrowRight", group: "Playback" },
  { id: "goto-start", label: "Go to start", shortcut: "Home", group: "Playback" },
  { id: "add-text", label: "Add text", shortcut: "T", group: "Insert" },
  { id: "add-effect", label: "Add effect…", shortcut: "E", group: "Insert" },
  { id: "import", label: "Import media…", shortcut: "Mod+I", group: "File" },
  { id: "export", label: "Export…", shortcut: "Mod+E", group: "File" },
  { id: "new", label: "New project", shortcut: "Mod+N", group: "File" },
  { id: "zoom-in", label: "Zoom timeline in", shortcut: "=", group: "View" },
  { id: "zoom-out", label: "Zoom timeline out", shortcut: "-", group: "View" },
  { id: "fit", label: "Fit timeline to window", shortcut: "Shift+Z", group: "View" },
  { id: "toggle-snap", label: "Toggle snapping", shortcut: "N", group: "View" },
  { id: "safe-areas", label: "Toggle safe areas", shortcut: "Mod+'", group: "View" },
  { id: "bookmark", label: "Add bookmark", shortcut: "B", group: "Insert" },
];

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

/** 1m 24s style short duration. */
export function shortDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(0)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

export function relativeTime(iso: string, now = new Date("2026-09-19T20:00:00+09:00")): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}분 전`;
  if (diff < 86400) return `${Math.round(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}
