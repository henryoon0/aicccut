import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { History, Search, X } from "lucide-react";
import { TabItem, Tabs, TabsList } from "#/components/ui/tabs";
import { Switch } from "#/components/ui/switch";
import { spring } from "#/lib/springs";
import { cn } from "#/lib/utils";
import { CLIPS } from "#/prototypes/mock";
import { EditorFrame } from "./frame";
import {
  BlendSelect,
  ColorField,
  FontSelect,
  PROP_LABEL,
  PropField,
  ResetButton,
  Row,
  SECTIONS,
  useElement,
  type ElementApi,
  type PropKey,
  type SectionId,
} from "./shared";

type Kind = "text" | "video";

const TEXT_CLIP = CLIPS.find((c) => c.id === "c10")!;
const VIDEO_CLIP = CLIPS.find((c) => c.id === "c1")!;

/** Section order per selection kind — the most-edited group comes first. */
const ORDER: Record<Kind, SectionId[]> = {
  text: ["typography", "transform", "background", "blending"],
  video: ["transform", "blending"],
};

const KEYWORDS: Partial<Record<PropKey, string>> = {
  x: "position horizontal left",
  y: "position vertical top",
  scale: "size zoom",
  rotation: "rotate angle",
  opacity: "alpha transparency",
  blend: "blending mode multiply screen",
  font: "typeface family",
  fontSize: "text size",
  weight: "bold font weight",
  letterSpacing: "tracking kerning",
  lineHeight: "leading",
  color: "text colour fill",
  fillEnabled: "background toggle show",
  fill: "background colour",
  fillPadding: "background inset",
  fillRadius: "corner rounded",
};

/**
 * Contextual — a search box filters properties, sections reorder by what
 * the selected element is, and whatever you touched last is pinned to a
 * Recent strip. The panel adapts instead of staying fixed.
 */
export function Contextual() {
  const api = useElement();
  const [kind, setKind] = useState<Kind>("text");
  const [query, setQuery] = useState("");

  const sections = ORDER[kind];
  const visibleKeys = useMemo(() => sections.flatMap((s) => SECTIONS[s].keys), [sections]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return visibleKeys.filter((k) => `${PROP_LABEL[k]} ${KEYWORDS[k] ?? ""}`.toLowerCase().includes(q));
  }, [query, visibleKeys]);

  const recent = api.recent.filter((k) => visibleKeys.includes(k)).slice(0, 3);

  return (
    <EditorFrame element={api.props} panelWidth={320}>
      <div className="flex shrink-0 flex-col gap-2 border-b border-border p-2.5">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)} size="compact">
          <TabsList className="w-full">
            <TabItem value="text" label={TEXT_CLIP.label} />
            <TabItem value="video" label={VIDEO_CLIP.label} />
          </TabsList>
        </Tabs>
        <label className="relative flex h-8 items-center rounded-md bg-surface-3 shadow-surface-2 focus-within:ring-1 focus-within:ring-[color:var(--focus-ring,#6B97FF)]">
          <Search size={13} className="absolute left-2.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search properties…"
            aria-label="Search properties"
            className="h-full w-full bg-transparent pl-8 pr-7 text-[12px] outline-none placeholder:text-muted-foreground/70"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-1.5 grid size-5 place-items-center rounded text-muted-foreground hover:bg-hover hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {matches ? (
          <div className="flex flex-col gap-2 p-3">
            <p className="text-[11px] text-muted-foreground">
              {matches.length === 0 ? `Nothing matches “${query}”` : `${matches.length} of ${visibleKeys.length} properties`}
            </p>
            {matches.map((k) => (
              <Row key={k} label={<Highlight text={PROP_LABEL[k]} query={query} />}>
                <PropControl api={api} k={k} />
              </Row>
            ))}
          </div>
        ) : (
          <LayoutGroup>
            <AnimatePresence initial={false}>
              {recent.length > 0 && (
                <motion.section
                  key="recent"
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={spring.moderate}
                  className="border-b border-border bg-surface-3/60 px-3 py-2.5"
                >
                  <header className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <History size={11} /> Recent
                  </header>
                  <div className="flex flex-col gap-1.5">
                    {recent.map((k) => (
                      <motion.div key={k} layout transition={spring.moderate}>
                        <Row label={PROP_LABEL[k]} compact>
                          <PropControl api={api} k={k} />
                        </Row>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
            {sections.map((id, i) => (
              <motion.section key={id} layout transition={spring.moderate} className="border-b border-border px-3 py-3 last:border-b-0">
                <header className="mb-2 flex h-6 items-center gap-2">
                  <h3 className="flex-1 text-[12px] font-medium">{SECTIONS[id].title}</h3>
                  {i === 0 && <span className="rounded bg-selected/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">most used</span>}
                  <ResetButton onClick={() => api.reset(SECTIONS[id].keys)} disabled={api.isDefault(SECTIONS[id].keys)} />
                </header>
                <div className="flex flex-col gap-2">
                  {SECTIONS[id].keys.map((k) => (
                    <Row key={k} label={PROP_LABEL[k]}>
                      <PropControl api={api} k={k} />
                    </Row>
                  ))}
                </div>
              </motion.section>
            ))}
          </LayoutGroup>
        )}
      </div>
    </EditorFrame>
  );
}

/** One control per property, so any list of keys can render itself. */
function PropControl({ api, k }: { api: ElementApi; k: PropKey }) {
  switch (k) {
    case "blend": return <BlendSelect api={api} />;
    case "font": return <FontSelect api={api} />;
    case "color": return <ColorField api={api} k="color" />;
    case "fill": return <ColorField api={api} k="fill" />;
    case "fillEnabled":
      return <Switch label="Show background" checked={api.props.fillEnabled} onToggle={() => api.set("fillEnabled", !api.props.fillEnabled)} />;
    case "fontSize":
    case "fillPadding":
    case "fillRadius":
      return <PropField api={api} k={k} suffix="px" />;
    default:
      return <PropField api={api} k={k} />;
  }
}

function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const i = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (i < 0 || !query.trim()) return text;
  const end = i + query.trim().length;
  return (
    <>
      {text.slice(0, i)}
      <mark className={cn("rounded-[2px] bg-[#6B97FF]/25 text-foreground")}>{text.slice(i, end)}</mark>
      {text.slice(end)}
    </>
  );
}
