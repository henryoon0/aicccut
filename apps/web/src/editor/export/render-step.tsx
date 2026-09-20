import { useEffect, useState } from "react";
import { Check, Copy, Download, FolderOpen, Upload, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Tooltip } from "#/components/ui/tooltip";
import { fileSize } from "#/editor/core";
import { dimensions, estimateBytes, formatDef, fpsValue, projectFileName, type Destination, type ExportContext, type ExportSettings } from "./settings";
import { etaLabel, type RenderState } from "./render";
import { FramePreview } from "./frame";

const NOTE = "이 버전에는 영상 인코더가 아직 없어서 프로젝트 파일을 내보냅니다.";

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
                프레임 {state.totalFrames.toLocaleString()}개 처리 ·{" "}
                {audioOnly ? formatDef(s.format).label : `${out.width}×${out.height} · ${fpsValue(s, ctx)}fps`} · 약 {fileSize(estimateBytes(s, ctx))}
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {destination === "download" && (
                <Button leadingIcon={Download} onClick={onDownload}>프로젝트 파일 다운로드</Button>
              )}
              {destination === "link" && (
                <Button leadingIcon={copied ? Check : Copy} onClick={() => void copyLink()}>
                  {copied ? "링크를 복사했습니다" : "링크 복사"}
                </Button>
              )}
              {destination === "drive" && (
                <Tooltip content="준비 중">
                  <span className="inline-flex"><Button leadingIcon={FolderOpen} disabled>드라이브에서 열기</Button></span>
                </Tooltip>
              )}
              <Button variant="ghost" onClick={onAgain}>다시 내보내기</Button>
            </div>
          </div>
        ) : state.status === "cancelled" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-[13px] text-muted-foreground">
              {Math.round(state.progress * 100)}%에서 내보내기를 취소했습니다.
            </div>
            <div className="flex gap-2">
              <Button leadingIcon={Upload} onClick={onRetry}>다시 시도</Button>
              <Button variant="ghost" onClick={onBack}>이전</Button>
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
              aria-label="렌더링 진행률"
              aria-valuenow={Math.round(state.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-7"
            >
              <div className="h-full rounded-full bg-foreground transition-[width] duration-100 ease-linear" style={{ width: `${state.progress * 100}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] tabular-nums text-muted-foreground">
              <span>{Math.round(state.progress * 100)}% · {state.frame.toLocaleString()}/{state.totalFrames.toLocaleString()} 프레임</span>
              <span>{state.fps.toLocaleString()}fps</span>
            </div>
            <div className="mt-5 flex justify-center">
              <Button variant="secondary" leadingIcon={X} onClick={onCancel}>취소</Button>
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
