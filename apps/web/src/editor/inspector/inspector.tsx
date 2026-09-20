/**
 * Inspector — the right-hand panel. Every section is a raised card: Transform,
 * Blending, Typography (text clips only), Effects and the clip's own timing.
 * Values shown are the clip evaluated at the playhead, so animated properties
 * read as they will render; edits write keyframes or static props depending on
 * the stopwatch.
 */
import { MousePointerSquareDashed } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import {
  BLEND_MODES,
  DEFAULT_TEXT_STYLE,
  timecode,
  useActions,
  useEditor,
  useSelection,
  useTime,
  type BlendMode,
  type Channel,
  type Clip,
  type ClipText,
} from "#/editor/core";
import { ChannelNumber, ChannelSlider, useChannelApi } from "./channels";
import { EffectsCard } from "./effects-card";
import { AlignRow, ColorRow, FontField, TextMetrics, isDefaultTextStyle, type TextApi } from "./text-controls";
import { Card, Field, useSelectedClip, useTrackName } from "./shared";

const TRANSFORM_KEYS: Channel[] = ["x", "y", "scale", "rotation"];

export function Inspector() {
  const clip = useSelectedClip();
  const count = useSelection().clipIds.length;
  const trackName = useTrackName(clip?.trackId);

  if (!clip) {
    return (
      <div className="flex h-full w-full min-h-0 flex-col items-center justify-center gap-2 bg-surface-2 p-6 text-center">
        <MousePointerSquareDashed size={20} strokeWidth={1.5} className="text-muted-foreground" />
        <p className="text-[13px] font-medium">클립을 선택하세요</p>
        <p className="max-w-[220px] text-[12px] text-muted-foreground">변형·효과·글자 설정이 여기에 나타납니다.</p>
      </div>
    );
  }

  return <ClipInspector key={clip.id} clip={clip} trackName={trackName} extraSelected={count - 1} />;
}

function ClipInspector({ clip, trackName, extraSelected }: { clip: Clip; trackName: string; extraSelected: number }) {
  const actions = useActions();
  const fps = useEditor((s) => s.doc.project.fps);
  const t = useTime();
  const api = useChannelApi(clip, t);
  const p = clip.props;

  const clearChannels = (channels: Channel[]) => {
    for (const ch of channels) actions.clearChannel(clip.id, ch);
  };

  const textApi: TextApi | null = p.text
    ? {
        text: p.text,
        patch: (patch: Partial<ClipText>, preview?: boolean) => actions.setClipText(clip.id, patch, preview ? { preview: true } : undefined),
        commit: () => actions.commit(),
      }
    : null;

  const transformIsDefault = p.x === 0 && p.y === 0 && p.scale === 100 && p.rotation === 0 && !TRANSFORM_KEYS.some((ch) => api.animated(ch));
  const blendIsDefault = p.opacity === 100 && p.blend === "Normal" && !api.animated("opacity");

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-surface-2">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold text-black" style={{ background: clip.tint }}>
          {p.text ? "T" : clip.label.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-medium">{clip.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {trackName}
            {extraSelected > 0 && ` · 외 ${extraSelected}개 선택됨`}
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <Card
          title="변형"
          resetDisabled={transformIsDefault}
          onReset={() => {
            clearChannels(TRANSFORM_KEYS);
            actions.updateClipProps(clip.id, { x: 0, y: 0, scale: 100, rotation: 0 });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <ChannelNumber api={api} ch="x" min={-1920} max={1920} step={2} suffix="px" />
            <ChannelNumber api={api} ch="y" min={-1920} max={1920} step={2} suffix="px" />
          </div>
          <ChannelSlider api={api} ch="scale" min={0} max={400} step={1} suffix="%" />
          <ChannelSlider api={api} ch="rotation" min={-360} max={360} step={1} suffix="°" />
        </Card>

        <Card
          title="합성"
          resetDisabled={blendIsDefault}
          onReset={() => {
            clearChannels(["opacity"]);
            actions.updateClipProps(clip.id, { opacity: 100, blend: "Normal" });
          }}
        >
          <ChannelSlider api={api} ch="opacity" min={0} max={100} step={1} suffix="%" />
          <Field label="혼합 모드">
            <Select value={p.blend} onValueChange={(v) => actions.updateClipProps(clip.id, { blend: v as BlendMode })}>
              <SelectTrigger aria-label="혼합 모드" className="w-full" />
              <SelectContent>
                {BLEND_MODES.map((m, i) => (
                  <SelectItem key={m} index={i} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Card>

        {textApi && (
          <Card
            title="글자"
            resetDisabled={isDefaultTextStyle(textApi.text)}
            onReset={() => actions.setClipText(clip.id, { ...DEFAULT_TEXT_STYLE })}
          >
            <Field label="글꼴">
              <FontField api={textApi} />
            </Field>
            <TextMetrics api={textApi} />
            <Field label="정렬">
              <AlignRow api={textApi} />
            </Field>
            <Field label="색상">
              <ColorRow api={textApi} />
            </Field>
          </Card>
        )}

        <EffectsCard clip={clip} api={api} />

        <Card title="클립 정보">
          <div className="flex flex-col gap-2 text-[12px]">
            <ReadOnly label="시작" value={timecode(clip.start, fps)} />
            <ReadOnly label="길이" value={timecode(clip.duration, fps)} />
            <ReadOnly label="시작점" value={timecode(clip.inPoint, fps)} />
          </div>
          <Switch label="음소거" checked={clip.muted === true} onToggle={() => actions.toggleClipsMuted([clip.id])} />
        </Card>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}
