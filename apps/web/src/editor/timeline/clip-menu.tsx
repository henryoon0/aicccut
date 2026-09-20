/**
 * The clip's right-click menu — the primary editing surface. Every item is a
 * core action and carries the same shortcut the global key handler owns.
 */
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Delete02Icon, InformationCircleIcon, Scissor01Icon, VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "#/components/ui/context-menu";
import { endOf, useActions, useEditor, useEditorContext } from "#/editor/core";
import type { Clip } from "#/editor/core";
import { useShortcutText } from "./keys";

export function ClipMenuItems({ clip }: { clip: Clip }) {
  const actions = useActions();
  const { time } = useEditorContext();
  const selection = useEditor((s) => s.selection.clipIds);
  const key = useShortcutText();

  const t = time.get();
  const inside = t > clip.start && t < endOf(clip);
  // Menu actions apply to the selection when this clip is part of it.
  const targets = selection.includes(clip.id) ? selection : [clip.id];

  return (
    <>
      <ContextMenuGroup>
        <ContextMenuLabel className="truncate">
          {clip.label} · {clip.duration.toFixed(2)}초
        </ContextMenuLabel>
      </ContextMenuGroup>
      <ContextMenuItem disabled={!inside} onClick={() => actions.splitClips(targets, time.get())}>
        <HugeiconsIcon icon={Scissor01Icon} size={14} strokeWidth={1.5} /> 분할
        <ContextMenuShortcut>{key("S")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!inside} onClick={() => actions.trimToTime(clip.id, "start", time.get())}>
        시작점을 재생 헤드로
        <ContextMenuShortcut>{key("[")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!inside} onClick={() => actions.trimToTime(clip.id, "end", time.get())}>
        끝점을 재생 헤드로
        <ContextMenuShortcut>{key("]")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => actions.duplicateClip(clip.id)}>
        <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={1.5} /> 복제
        <ContextMenuShortcut>{key("Mod+D")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={() => actions.toggleClipsMuted(targets)}>
        <HugeiconsIcon icon={clip.muted ? VolumeHighIcon : VolumeOffIcon} size={14} strokeWidth={1.5} />
        {clip.muted ? "음소거 해제" : "음소거"}
        <ContextMenuShortcut>{key("Shift+M")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={() => actions.deleteClips(targets, false)}>
        <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.5} /> 삭제
        <ContextMenuShortcut>{key("Backspace")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem variant="destructive" onClick={() => actions.deleteClips(targets, true)}>
        <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.5} /> 리플 삭제
        <ContextMenuShortcut>{key("Shift+Backspace")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => {
          actions.select(clip.id, false);
          actions.setUi({ inspector: true });
        }}
      >
        <HugeiconsIcon icon={InformationCircleIcon} size={14} strokeWidth={1.5} /> 속성…
        <ContextMenuShortcut>{key("I")}</ContextMenuShortcut>
      </ContextMenuItem>
    </>
  );
}
