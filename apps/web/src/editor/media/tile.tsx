/**
 * One asset tile in the media grid: a 4:3 thumbnail with kind, resolution and
 * duration badges, the name sliding up on hover, and a per-tile menu (add at
 * playhead / rename inline / remove). Pressing starts a timeline drag once the
 * pointer moves; a plain click just selects.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { DropdownContent, DropdownMenu, DropdownSeparator, DropdownTrigger } from "#/components/ui/dropdown";
import { MenuItem } from "#/components/ui/menu-item";
import { cn } from "#/lib/utils";
import { shortDuration, type Asset } from "#/editor/core";
import { resolution, shortRes } from "./helpers";
import { KindIcon, Thumb } from "./thumb";

const BADGE = "rounded-[4px] bg-black/55 px-1 py-px text-[10px] text-white";

export interface TileProps {
  asset: Asset;
  selected: boolean;
  renaming: boolean;
  onSelect: () => void;
  /** Double-click or Enter: add the asset at the playhead. */
  onOpen: () => void;
  onDragStart: (e: ReactPointerEvent) => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onRemove: () => void;
}

export function Tile(props: TileProps) {
  const { asset, selected, renaming, onSelect, onOpen, onDragStart, onStartRename, onCommitRename, onCancelRename, onRemove } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const res = shortRes(asset);

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={asset.name}
      data-id={asset.id}
      onPointerDown={(e) => {
        if (renaming) return;
        onSelect();
        onDragStart(e);
      }}
      onDoubleClick={renaming ? undefined : onOpen}
      className={cn(
        "group relative touch-none select-none overflow-hidden rounded-lg ring-offset-1 ring-offset-surface-2 transition-[box-shadow,transform] duration-80",
        renaming ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        selected ? "ring-2 ring-foreground" : "hover:ring-1 hover:ring-border",
      )}
    >
      <Thumb asset={asset} className="aspect-[4/3] w-full">
        <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-[4px] bg-black/45 text-white">
          <KindIcon kind={asset.kind} size={11} />
        </span>

        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          {res && <span className={cn(BADGE, "bg-black/45 font-medium")}>{res}</span>}
          <DropdownMenu size="compact" open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownTrigger
              render={
                <button
                  type="button"
                  aria-label={`${asset.name} 메뉴`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className={cn(
                    "grid size-5 cursor-pointer place-items-center rounded-[4px] bg-black/55 text-white outline-none transition-opacity duration-80",
                    "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                    menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <MoreHorizontal size={12} strokeWidth={2} />
                </button>
              }
            />
            <DropdownContent align="end">
              <MenuItem index={0} label="재생 헤드 위치에 추가" onSelect={onOpen} />
              <MenuItem index={1} label="이름 바꾸기" onSelect={onStartRename} />
              <DropdownSeparator />
              <MenuItem index={2} label="삭제 (타임라인의 클립도 함께 삭제)" onSelect={onRemove} />
            </DropdownContent>
          </DropdownMenu>
        </div>

        {asset.kind !== "image" && (
          <span className={cn(BADGE, "absolute bottom-1.5 right-1.5 tabular-nums transition-opacity duration-150 group-hover:opacity-0")}>
            {shortDuration(asset.duration)}
          </span>
        )}

        {!renaming && (
          <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/85 to-black/0 px-2 pb-1.5 pt-5 text-white opacity-0 transition-[transform,opacity] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none">
            <div className="truncate text-[11px] font-medium">{asset.name}</div>
            <div className="text-[10px] text-white/70">
              {asset.width ? resolution(asset) : "오디오"}
              {asset.fps ? ` · ${asset.fps}fps` : ""}
            </div>
          </div>
        )}
      </Thumb>

      {renaming && <RenameField name={asset.name} onCommit={onCommitRename} onCancel={onCancelRename} />}
    </div>
  );
}

function RenameField({ name, onCommit, onCancel }: { name: string; onCommit: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  const settled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Select the stem, leaving the extension alone — that is what is retyped.
    const dot = name.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : name.length);
  }, [name]);

  const finish = (commit: boolean) => {
    if (settled.current) return;
    settled.current = true;
    const next = value.trim();
    if (commit && next && next !== name) onCommit(next);
    else onCancel();
  };

  return (
    <div className="absolute inset-x-0 bottom-0 bg-black/80 p-1">
      <input
        ref={ref}
        value={value}
        aria-label={`${name} 이름 바꾸기`}
        onChange={(e) => setValue(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") finish(true);
          if (e.key === "Escape") finish(false);
        }}
        onBlur={() => finish(true)}
        className="w-full rounded-[4px] bg-white/10 px-1.5 py-1 text-[11px] text-white outline-none ring-1 ring-white/30 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
      />
    </div>
  );
}
