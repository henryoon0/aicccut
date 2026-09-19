/**
 * Inline — import is a row, not a room. The library is already populated;
 * a compact "+ Import" strip sits on top and new files appear in place as
 * shimmering skeleton cards that resolve into thumbnails as progress lands.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ClipboardIcon, FolderOpenIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "#/components/ui/button.tsx";
import { Tabs, TabsList, TabItem } from "#/components/ui/tabs.tsx";
import { spring } from "#/lib/springs.ts";
import { cn } from "#/lib/utils.ts";
import { ASSETS, shortDuration, type AssetKind } from "#/prototypes/mock";
import {
  EditorFrame,
  KindIcon,
  Thumb,
  metaLine,
  useDropTarget,
  useFilePicker,
  useImportQueue,
  usePasteImport,
  type ImportItem,
  asIcon,
} from "./shared";

const BrowseIcon = asIcon(FolderOpenIcon);

type Filter = "all" | AssetKind;

export function Inline() {
  const q = useImportQueue({ initialLibrary: ASSETS.slice(0, 6), concurrency: 3 });
  const [filter, setFilter] = useState<Filter>("all");
  const start = (n: number) => q.importSome(n);
  const { over, bind } = useDropTarget((n) => start(n));
  const picker = useFilePicker(start);
  usePasteImport(() => start(1));

  const visible = q.library.filter((a) => filter === "all" || a.kind === filter);
  // Newest first, so imports land where the eye already is.
  const ordered = [...visible].reverse();
  const pending = q.items.filter((i) => i.status !== "done");

  return (
    <EditorFrame
      mediaWidth={352}
      media={
        <div className="flex min-h-0 flex-1 flex-col" {...bind}>
          {picker.input}
          <style>{`@keyframes mi-shimmer{from{background-position:120% 0}to{background-position:-120% 0}}`}</style>
          <div className="shrink-0 space-y-2 border-b border-border p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 flex-1 items-center gap-1.5 rounded-md bg-surface-3 px-2 text-[11.5px] text-muted-foreground ring-1 ring-border">
                <HugeiconsIcon icon={Search01Icon} size={13} strokeWidth={1.5} />
                <input placeholder="Search media" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabItem value="all" label="All" />
                  <TabItem value="video" label="V" />
                  <TabItem value="audio" label="A" />
                  <TabItem value="image" label="I" />
                </TabsList>
              </Tabs>
            </div>

            {/* The import strip: one compact row, three verbs */}
            <div
              className={cn(
                "flex h-8 items-center gap-1 rounded-md border border-dashed pl-2 pr-1 text-[11.5px] transition-colors duration-150",
                over ? "border-foreground/60 bg-selected text-foreground" : "border-border text-muted-foreground",
              )}
            >
              <HugeiconsIcon icon={Add01Icon} size={13} strokeWidth={1.75} />
              <span className="flex-1 truncate">{over ? "Release to import" : "Drop files here"}</span>
              <Button variant="ghost" size="compact" leadingIcon={BrowseIcon} onClick={picker.open}>
                Browse
              </Button>
              <Button variant="ghost" size="icon-compact" aria-label="Paste from clipboard" onClick={() => start(1)}>
                <HugeiconsIcon icon={ClipboardIcon} size={13} strokeWidth={1.5} />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            <div className="grid grid-cols-3 gap-1.5">
              <AnimatePresence initial={false}>
                {pending.map((it) => (
                  <SkeletonCard key={it.id} item={it} />
                ))}
              </AnimatePresence>
              {ordered.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  transition={spring.moderate}
                  className="group overflow-hidden rounded-md bg-surface-3 ring-1 ring-transparent transition-colors hover:ring-foreground/30"
                >
                  <div className="relative">
                    <Thumb asset={a} className="aspect-[4/3]" />
                    {a.duration > 0 && (
                      <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 font-mono text-[9.5px] tabular-nums text-white/90">{shortDuration(a.duration)}</span>
                    )}
                    <span className="absolute left-1 top-1 grid size-4 place-items-center rounded bg-black/55 text-white/90"><KindIcon kind={a.kind} size={10} /></span>
                  </div>
                  <div className="truncate px-1.5 py-1 text-[10.5px]" title={a.name}>{a.name}</div>
                </motion.div>
              ))}
            </div>
            <p className="mt-3 text-center text-[10.5px] text-muted-foreground">
              {q.library.length} items{pending.length ? ` · ${pending.length} importing` : ""}
            </p>
          </div>
        </div>
      }
    />
  );
}

function SkeletonCard({ item }: { item: ImportItem }) {
  const p = item.progress;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={spring.moderate}
      className="overflow-hidden rounded-md bg-surface-3 ring-1 ring-border"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-4">
        {/* shimmer while the tint is still "decoding" */}
        {item.status !== "done" && (
          <div
            className="absolute inset-0 motion-reduce:hidden"
            style={{
              background: "linear-gradient(100deg, transparent 30%, color-mix(in oklab, var(--foreground) 10%, transparent) 50%, transparent 70%)",
              backgroundSize: "250% 100%",
              animation: "mi-shimmer 1.1s linear infinite",
            }}
          />
        )}
        {/* thumbnail reveals from the left as progress lands */}
        <Thumb asset={item.asset} className="absolute inset-0" />
        <div className="absolute inset-y-0 right-0 bg-surface-4/95 transition-[width] duration-100" style={{ width: `${(1 - p) * 100}%` }} />
        <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 font-mono text-[9.5px] tabular-nums text-white/90">
          {item.status === "queued" ? "queued" : `${Math.round(p * 100)}%`}
        </span>
      </div>
      <div className="px-1.5 py-1">
        <div className="h-[10px] w-4/5 rounded-sm bg-surface-5 motion-reduce:animate-none" style={{ opacity: 0.6 + p * 0.4 }}>
          <span className="sr-only">{item.asset.name}</span>
        </div>
        <div className="mt-1 truncate text-[9.5px] text-muted-foreground">{metaLine(item.asset)}</div>
      </div>
    </motion.div>
  );
}
