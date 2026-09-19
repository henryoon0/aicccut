/**
 * `TransportBar` — a fixed bar under the canvas. Timecode left (click to type
 * a time), transport centred, view options right. Nothing moves, nothing
 * hides; every control keeps a permanent address.
 */
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  FrameIcon,
  Grid02Icon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  documentDuration,
  formatShortcut,
  isMacPlatform,
  parseTimecode,
  timecode,
  useActions,
  useEditor,
  useEditorContext,
  useTime,
  useTransportState,
  type Fps,
  type Transport,
} from "#/editor/core";
import { Button } from "#/components/ui/button";
import { Kbd } from "#/components/ui/kbd";
import { Slider } from "#/components/ui/slider";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import { clamp } from "./helpers";

/** Shortest scrubber span, so a two-clip project still has a usable track. */
const MIN_SPAN = 30;

export function TransportBar() {
  const { transport } = useEditorContext();
  const { playing, loop } = useTransportState();
  const actions = useActions();
  const fps = useEditor((s) => s.doc.project.fps);
  const duration = useEditor((s) => Math.max(MIN_SPAN, documentDuration(s.doc)));
  const zoom = useEditor((s) => s.uiPanels.previewZoom);
  const safeAreas = useEditor((s) => s.uiPanels.safeAreas);
  const grid = useEditor((s) => s.uiPanels.grid);

  return (
    <div className="w-full shrink-0 border-t border-border bg-surface-2">
      {/* Full width so the thumb maps 1:1 onto the timeline below. */}
      <div className="px-3 pt-1">
        <Scrubber transport={transport} duration={duration} fps={fps} />
      </div>

      <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
        <div className="flex items-center gap-1.5 font-mono text-[12px] tabular-nums">
          <EditableTimecode transport={transport} fps={fps} duration={duration} />
          <span className="text-muted-foreground">/ {timecode(duration, fps)}</span>
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton icon={SkipBackIcon} label="Go to start" shortcut="Home" onClick={() => transport.goToStart()} />
          <IconButton icon={ArrowLeft01Icon} label="Previous frame" shortcut="ArrowLeft" onClick={() => transport.stepFrames(-1)} />
          <IconButton
            icon={playing ? PauseIcon : PlayIcon}
            label={playing ? "Pause" : "Play"}
            shortcut="Space"
            size="icon"
            variant="secondary"
            onClick={() => transport.toggle()}
          />
          <IconButton icon={ArrowRight01Icon} label="Next frame" shortcut="ArrowRight" onClick={() => transport.stepFrames(1)} />
          <IconButton icon={SkipForwardIcon} label="Go to end" shortcut="End" onClick={() => transport.goToEnd()} />
          <IconButton icon={RepeatIcon} label="Loop" shortcut="Alt+L" active={loop} onClick={() => transport.toggleLoop()} />
        </div>

        <div className="flex items-center justify-end gap-1">
          <IconButton icon={FrameIcon} label="Safe areas" shortcut="Mod+'" active={safeAreas} onClick={() => actions.toggleUi("safeAreas")} />
          <IconButton icon={Grid02Icon} label="Grid" shortcut="Mod+;" active={grid} onClick={() => actions.toggleUi("grid")} />
          <span className="mx-1 h-4 w-px bg-border" />
          <Tabs
            size="compact"
            value={zoom === "fit" ? "fit" : String(zoom)}
            onValueChange={(v) => actions.setUi({ previewZoom: v === "fit" ? "fit" : Number(v) })}
          >
            <TabsList aria-label="Preview zoom">
              <TabItem value="fit" label="Fit" />
              <TabItem value="50" label="50%" />
              <TabItem value="100" label="100%" />
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Scrubber ───────────────────────────────────────────────

/** Isolated so the playhead only re-renders the track, not the whole bar. */
function Scrubber({ transport, duration, fps }: { transport: Transport; duration: number; fps: Fps }) {
  const time = useTime();
  return (
    <Slider
      aria-label="Scrub"
      variant="scrubber"
      value={Math.min(time, duration)}
      onChange={(v) => {
        transport.pause();
        transport.seek(Array.isArray(v) ? v[0] : v);
      }}
      min={0}
      max={duration}
      step={1 / fps}
      formatValue={(v) => timecode(v, fps)}
    />
  );
}

// ── Timecode ───────────────────────────────────────────────

/** Click to type a time; Enter commits, Esc cancels, ↑/↓ nudge a frame. */
function EditableTimecode({ transport, fps, duration }: { transport: Transport; fps: Fps; duration: number }) {
  const time = useTime();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const commit = () => {
    const t = parseTimecode(draft, fps);
    if (t == null) {
      setInvalid(true);
      return;
    }
    transport.pause();
    transport.seek(t);
    setEditing(false);
    setInvalid(false);
  };

  if (editing) {
    return (
      <input
        ref={input}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onBlur={() => {
          setEditing(false);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(false);
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const t = parseTimecode(draft, fps) ?? time;
            setDraft(timecode(clamp(t + (e.key === "ArrowUp" ? 1 / fps : -1 / fps), 0, duration), fps));
          }
        }}
        aria-label="Current time"
        aria-invalid={invalid}
        className={cn(
          "h-7 w-[112px] rounded-md border bg-surface-3 px-2 font-mono text-[12px] tabular-nums text-foreground outline-none ring-2",
          invalid ? "border-destructive ring-destructive/30" : "border-border ring-foreground/20",
        )}
      />
    );
  }

  return (
    <Tooltip
      side="top"
      content={
        <span className="flex items-center gap-1.5">
          Click to type a time <Kbd>00:00:12.15</Kbd>
        </span>
      }
    >
      <button
        type="button"
        aria-label="Current time"
        onClick={() => {
          transport.pause();
          setDraft(timecode(time, fps));
          setEditing(true);
        }}
        className="h-7 rounded-md border border-transparent px-2 text-foreground hover:border-border hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
      >
        {timecode(time, fps)}
      </button>
    </Tooltip>
  );
}

// ── Icon button ────────────────────────────────────────────

interface IconButtonProps {
  icon: IconSvgElement;
  label: string;
  /** Registry spelling, e.g. "Mod+'" or "ArrowLeft". */
  shortcut?: string;
  onClick?: () => void;
  active?: boolean;
  size?: "icon" | "icon-compact";
  variant?: "ghost" | "tertiary" | "secondary" | "primary";
}

function IconButton({ icon, label, shortcut, onClick, active, size = "icon-compact", variant = "ghost" }: IconButtonProps) {
  const mac = useIsMac();
  return (
    <Tooltip
      side="top"
      content={
        <span className="flex items-center gap-1.5">
          {label}
          {shortcut && <Kbd>{formatShortcut(shortcut, mac).join(mac ? "" : "+")}</Kbd>}
        </span>
      }
    >
      <Button variant={variant} size={size} active={active} aria-pressed={active} aria-label={label} onClick={onClick}>
        <HugeiconsIcon icon={icon} size={size === "icon" ? 18 : 16} strokeWidth={1.5} />
      </Button>
    </Tooltip>
  );
}

/** Platform check deferred to an effect so server and client render the same. */
function useIsMac(): boolean {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(isMacPlatform()), []);
  return mac;
}
