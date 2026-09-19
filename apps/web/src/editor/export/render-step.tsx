import { useEffect, useState } from "react";
import { Check, Copy, Download, FolderOpen, Upload, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Tooltip } from "#/components/ui/tooltip";
import { fileSize } from "#/editor/core";
import { dimensions, estimateBytes, formatDef, fpsValue, projectFileName, type Destination, type ExportContext, type ExportSettings } from "./settings";
import { etaLabel, type RenderState } from "./render";
import { FramePreview } from "./frame";

const NOTE = "Video encoding is not wired up yet in this build; this exports the project file.";

export interface RenderStepProps {
  settings: ExportSettings;
  ctx: ExportContext;
  destination: Destination;
  name: string;
  state: RenderState;
  onCancel: () => void;
  onRetry: () => void;
  onBack: () => void;
  onAgain: () => void;
  onDownload: () => void;
}

/**
 * The render screen: one big thumbnail of the frame being walked, one calm
 * bar under it, and actions that change with the destination once it lands.
 */
export function RenderStep({ settings: s, ctx, destination, name, state, onCancel, onRetry, onBack, onAgain, onDownload }: RenderStepProps) {
  const audioOnly = Boolean(formatDef(s.format).audioOnly);
  const fileName = projectFileName(name);
  const out = dimensions(s, ctx);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copyLink = async () => {
    const href = window.location.href;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      // Clipboard permission can be refused; the address bar still has it.
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <FramePreview
        frame={state.frameInfo}
        canvas={{ width: ctx.width, height: ctx.height }}
        fps={fpsValue(s, ctx)}
        showTimecode={!audioOnly}
        done={state.status === "done"}
        className="mx-auto w-full max-w-[460px] shadow-surface-4"
      />

      <div className="mx-auto mt-5 w-full max-w-[460px]">
        {state.status === "done" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div>
              <div className="text-[15px] font-semibold">{fileName}</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                Walked {state.totalFrames.toLocaleString()} frames ·{" "}
                {audioOnly ? formatDef(s.format).label : `${out.width}×${out.height} · ${fpsValue(s, ctx)} fps`} · ~{fileSize(estimateBytes(s, ctx))} encoded
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {destination === "download" && (
                <Button leadingIcon={Download} onClick={onDownload}>Download project file</Button>
              )}
              {destination === "link" && (
                <Button leadingIcon={copied ? Check : Copy} onClick={() => void copyLink()}>
                  {copied ? "Link copied" : "Copy link"}
                </Button>
              )}
              {destination === "drive" && (
                <Tooltip content="Coming soon">
                  <span className="inline-flex"><Button leadingIcon={FolderOpen} disabled>Open in Drive</Button></span>
                </Tooltip>
              )}
              <Button variant="ghost" onClick={onAgain}>Export again</Button>
            </div>
          </div>
        ) : state.status === "cancelled" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-[13px] text-muted-foreground">
              Export cancelled at {Math.round(state.progress * 100)}%.
            </div>
            <div className="flex gap-2">
              <Button leadingIcon={Upload} onClick={onRetry}>Try again</Button>
              <Button variant="ghost" onClick={onBack}>Back</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] font-medium">{fileName}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{etaLabel(state.eta)}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Render progress"
              aria-valuenow={Math.round(state.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-7"
            >
              <div className="h-full rounded-full bg-foreground transition-[width] duration-100 ease-linear" style={{ width: `${state.progress * 100}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] tabular-nums text-muted-foreground">
              <span>{Math.round(state.progress * 100)}% · frame {state.frame.toLocaleString()} of {state.totalFrames.toLocaleString()}</span>
              <span>{state.fps.toLocaleString()} fps</span>
            </div>
            <div className="mt-5 flex justify-center">
              <Button variant="secondary" leadingIcon={X} onClick={onCancel}>Cancel</Button>
            </div>
          </>
        )}
      </div>

      <p className="mx-auto mt-6 w-full max-w-[460px] text-center text-[11px] leading-relaxed text-muted-foreground">
        {NOTE}
      </p>
    </div>
  );
}
