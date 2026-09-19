/**
 * Presentation data for the command surfaces: an icon per command, the one
 * line that teaches what it does, and the tiny word printed on its key cap.
 *
 * Keyed by the ids in `COMMAND_LIST`. Everything else (labels, groups,
 * shortcuts, enablement) comes from core; nothing is duplicated here.
 */
import {
  Bookmark, ChevronsLeft, ChevronsRight, CircleX, Command, Copy, Eraser, FastForward, FilePlus,
  Flag, FlagTriangleRight, FolderOpen, Frame, Grid2x2, Keyboard, Magnet, Maximize2, PanelLeft,
  PanelRight, Pause, Play, Redo2, Repeat, Rewind, Ruler, Scan, Scissors, Share2, SkipBack,
  SkipForward, Sparkles, SquareDashed, StepBack, StepForward, Trash2, Type, Undo2, VolumeX, Waves,
  X, ZoomIn, ZoomOut, type LucideIcon,
} from "lucide-react";

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
  split: "Cut the clip under the playhead in two",
  delete: "Remove the selected clips",
  "ripple-delete": "Remove the selection and close the gap",
  ripple: "Close gaps automatically when you delete or trim",
  undo: "Step back one change",
  redo: "Step forward one change",
  duplicate: "Copy the selected clip in place",
  "mute-clip": "Silence the selected clips, or bring them back",
  "trim-start-to-playhead": "Pull the clip's start up to the playhead",
  "trim-end-to-playhead": "Pull the clip's end back to the playhead",
  "select-all": "Select every clip on the timeline",
  deselect: "Drop the selection, or close the open dialog",
  play: "Start or stop playback",
  "prev-frame": "Nudge the playhead one frame back",
  "next-frame": "Nudge the playhead one frame forward",
  "prev-10-frames": "Jump ten frames back",
  "next-10-frames": "Jump ten frames forward",
  "goto-start": "Jump the playhead to 00:00",
  "goto-end": "Jump the playhead to the last frame",
  "shuttle-back": "Play in reverse; press again to go faster",
  "shuttle-stop": "Stop the shuttle where it is",
  "shuttle-forward": "Play forward; press again to go faster",
  "toggle-loop": "Repeat the in / out range while playing",
  "set-in": "Mark the range start at the playhead",
  "set-out": "Mark the range end at the playhead",
  "clear-in-out": "Drop both range marks",
  "add-text": "Drop a text layer at the playhead",
  "add-effect": "Browse effects for the selection",
  bookmark: "Mark this moment in the ruler",
  import: "Bring media into the library",
  export: "Render the project to a file",
  new: "Start a fresh project",
  "zoom-in": "Show less time, more detail",
  "zoom-out": "Show more of the timeline",
  fit: "Zoom so the whole project is visible",
  "zoom-overview": "The whole project at a glance",
  "zoom-normal": "The comfortable working zoom",
  "zoom-detail": "Close enough to see short clips",
  "zoom-frames": "Frame by frame",
  "toggle-snap": "Snap clips to edges and the playhead",
  "safe-areas": "Show title and action guides on the canvas",
  "toggle-grid": "Lay a grid over the canvas",
  "toggle-media-panel": "Show or hide the media panel",
  "toggle-inspector": "Show or hide the properties panel",
  "open-palette": "Run any command by name",
  "open-shortcuts": "Open this cheat sheet",
};

/** The word printed under a key cap when exactly one command owns the key. */
export const KEY_LABELS: Record<string, string> = {
  split: "Split", delete: "Delete", "ripple-delete": "Ripple", ripple: "Ripple", undo: "Undo",
  redo: "Redo", duplicate: "Copy", "mute-clip": "Mute", "trim-start-to-playhead": "Trim",
  "trim-end-to-playhead": "Trim", "select-all": "All", deselect: "Clear",
  play: "Play", "prev-frame": "Frame", "next-frame": "Frame", "prev-10-frames": "Frame",
  "next-10-frames": "Frame", "goto-start": "Start", "goto-end": "End", "shuttle-back": "Rev",
  "shuttle-stop": "Stop", "shuttle-forward": "Fwd", "toggle-loop": "Loop", "set-in": "In",
  "set-out": "Out", "clear-in-out": "Clear",
  "add-text": "Text", "add-effect": "Effect", bookmark: "Mark",
  import: "Import", export: "Export", new: "New",
  "zoom-in": "Zoom", "zoom-out": "Zoom", fit: "Fit", "zoom-overview": "Zoom", "zoom-normal": "Zoom",
  "zoom-detail": "Zoom", "zoom-frames": "Zoom", "toggle-snap": "Snap", "safe-areas": "Safe",
  "toggle-grid": "Grid", "toggle-media-panel": "Media", "toggle-inspector": "Props",
  "open-palette": "Run", "open-shortcuts": "Keys",
};
