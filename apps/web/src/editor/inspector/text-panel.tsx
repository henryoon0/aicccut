/**
 * TextPanel — the "Text" rail flyout. Pick a role (title, lower third…) from
 * real styled thumbnails and it lands on the text track at the playhead; the
 * full typographic controls sit underneath whenever a text clip is selected.
 */
import { Textarea } from "#/components/ui/textarea";
import { DEFAULT_TEXT_STYLE, useActions, usePlayhead, type ClipText, type TextStyle } from "#/editor/core";
import { cn } from "#/lib/utils";
import { fontFamilyFor } from "./fonts";
import { AlignRow, ColorRow, FontField, TextMetrics, isDefaultTextStyle, weightLabel, type TextApi } from "./text-controls";
import { Card, Field, useSelectedClip } from "./shared";

interface TextPreset {
  id: string;
  name: string;
  hint: string;
  /** Line the thumbnail shows, and the content of the clip it creates. */
  sample: string;
  duration: number;
  style: TextStyle;
  /** Offset from canvas centre, canvas px. */
  x: number;
  y: number;
}

const PRESETS: TextPreset[] = [
  {
    id: "title", name: "제목", hint: "첫 화면 제목, 가운데", sample: "훅(Hook)이란 무엇인가", duration: 5, x: 0, y: 0,
    style: { font: "Pretendard", size: 96, weight: 800, italic: false, tracking: -3, leading: 110, color: "#FFFFFF", align: "center" },
  },
  {
    id: "lower-third", name: "이름표 자막", hint: "화자 이름, 왼쪽 아래", sample: "이재윤 · AI Coffee Chat", duration: 4, x: -540, y: 330,
    style: { font: "Inter", size: 44, weight: 600, italic: false, tracking: 0, leading: 120, color: "#FFD166", align: "left" },
  },
  {
    id: "caption", name: "자막", hint: "화면 아래 자막 띠", sample: "훅은 도구 호출 앞뒤에 끼어드는 스크립트예요", duration: 3, x: 0, y: 400,
    style: { font: "Noto Sans KR", size: 40, weight: 500, italic: false, tracking: 0, leading: 140, color: "#FFFFFF", align: "center" },
  },
  {
    id: "callout", name: "강조 표시", hint: "시연 화면 가리키기", sample: "PreToolUse", duration: 3, x: -380, y: -220,
    style: { font: "JetBrains Mono", size: 56, weight: 700, italic: false, tracking: 4, leading: 120, color: "#2EC4B6", align: "left" },
  },
  {
    id: "quote", name: "인용", hint: "명조, 넓게, 기울임", sample: "“수료 다음 날부터 업무에 적용했어요”", duration: 6, x: 0, y: 0,
    style: { font: "Playfair Display", size: 72, weight: 500, italic: true, tracking: 0, leading: 125, color: "#F4F1EA", align: "center" },
  },
];

const THUMB_W = 132;
const THUMB_H = Math.round((THUMB_W * 9) / 16);
/** Canvas px → thumbnail px, lifted so the smallest preset stays readable. */
const TYPE_SCALE = (THUMB_W / 1920) * 2.4;

/** Inline CSS for a preset on its thumbnail: real family, weight and colour. */
function thumbCss(style: TextStyle) {
  return {
    fontFamily: fontFamilyFor(style.font),
    fontSize: Math.max(9, Math.round(style.size * TYPE_SCALE)),
    fontWeight: style.weight,
    fontStyle: style.italic ? ("italic" as const) : ("normal" as const),
    letterSpacing: `${style.tracking / 100}em`,
    lineHeight: style.leading / 100,
    color: style.color,
    textAlign: style.align,
  };
}

/** Where the preset sits on the canvas, as thumbnail flex alignment. */
function thumbPlacement(x: number, y: number): string {
  const vertical = y > 150 ? "items-end" : y < -150 ? "items-start" : "items-center";
  const horizontal = x < -150 ? "justify-start" : x > 150 ? "justify-end" : "justify-center";
  return `${vertical} ${horizontal}`;
}

function PresetCard({ preset, onPick }: { preset: TextPreset; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "group flex items-stretch gap-2.5 rounded-lg bg-surface-3 p-1.5 text-left shadow-surface-2 outline-none",
        "transition-colors duration-80 hover:bg-surface-4 focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
      )}
    >
      <span
        className={cn("flex shrink-0 overflow-hidden rounded-md bg-black p-1.5", thumbPlacement(preset.x, preset.y))}
        style={{ width: THUMB_W, height: THUMB_H }}
      >
        <span className="block w-full truncate" style={thumbCss(preset.style)}>
          {preset.sample}
        </span>
      </span>
      <span className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="truncate text-[12px] font-medium">{preset.name}</span>
        <span className="truncate text-[11px] text-muted-foreground">{preset.hint}</span>
        <span className="truncate text-[10px] text-muted-foreground/70">
          {preset.style.font} · {weightLabel(preset.style.weight)}
        </span>
      </span>
    </button>
  );
}

export function TextPanel() {
  const actions = useActions();
  const time = usePlayhead();
  const clip = useSelectedClip();
  const text = clip?.props.text;

  const add = (preset: TextPreset) => {
    // One history entry for the whole insert: add, style and place as previews.
    const id = actions.addTextClip(time.get(), preset.sample, preset.duration, { preview: true });
    if (!id) return;
    actions.setClipText(id, preset.style, { preview: true });
    actions.updateClipProps(id, { x: preset.x, y: preset.y }, { preview: true });
    actions.commit();
    actions.setSelection([id]);
  };

  const api: TextApi | null =
    clip && text
      ? {
          text,
          patch: (patch: Partial<ClipText>, preview?: boolean) => actions.setClipText(clip.id, patch, preview ? { preview: true } : undefined),
          commit: () => actions.commit(),
        }
      : null;

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-surface-2">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">프리셋</h3>
          <div className="flex flex-col gap-1.5">
            {PRESETS.map((p) => (
              <PresetCard key={p.id} preset={p} onPick={() => add(p)} />
            ))}
          </div>
        </section>

        {api ? (
          <Card
            title="스타일"
            resetDisabled={isDefaultTextStyle(api.text)}
            onReset={() => clip && actions.setClipText(clip.id, { ...DEFAULT_TEXT_STYLE })}
          >
            <Field label="내용">
              <Textarea
                value={api.text.content}
                onChange={(e) => api.patch({ content: e.target.value })}
                placeholder="텍스트를 입력하세요…"
                className="min-h-[72px] bg-surface-4 text-[13px] leading-relaxed"
              />
            </Field>
            <Field label="글꼴">
              <FontField api={api} />
            </Field>
            <TextMetrics api={api} />
            <Field label="정렬">
              <AlignRow api={api} />
            </Field>
            <Field label="색상">
              <ColorRow api={api} />
            </Field>
          </Card>
        ) : (
          <p className="rounded-lg bg-surface-3 p-3 text-[12px] text-muted-foreground shadow-surface-2">
            텍스트 클립을 선택하면 내용과 스타일을 편집할 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
}
