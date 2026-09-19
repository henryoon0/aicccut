# Editor app — area contract

`src/editor/core/` is the shared engine (read its README first). Each UI area
lives in its own folder and exports fixed component names from `index.tsx`:

| Folder | Exports | Ported from prototype |
| --- | --- | --- |
| home | `HomePage` | projects-home/Gallery + new-project/Sheet |
| shell | `EditorShell` (+ route `src/routes/editor.$projectId.tsx`) | editor-shell/Studio |
| media | `MediaPanel` | media-import/Dropzone + media-library/Grid |
| preview | `Preview`, `TransportBar` | preview-transport/Bar |
| timeline | `Timeline` | timeline/Classic + clip-editing/Contextual + keyframes-effects/Diamonds (lanes) |
| inspector | `Inspector`, `TextPanel`, `EffectsPanel` | inspector/Cards + text-tool/Panel (+ Browser font picker) + Diamonds stopwatches |
| export | `ExportWizard` | export/Wizard |
| commands | `CommandPalette`, `ShortcutsSheet` | command-palette/Learn |

Rules for every area:

- All state goes through `#/editor/core` (`useEditor`, `useActions`,
  `useEditorContext().time/transport`, `useCommandContext`). No local copies
  of clips/assets/keyframes except transient drag previews (use
  `{ preview: true }` then `actions.commit()`).
- Read the prototype source for the chosen variant and port its look and
  interactions faithfully; drop the harness frame (top bar/dim neighbours are
  the shell's job). Keep fluid components and tokens.
- Components must fill their slot (`h-full w-full min-h-0`) and never read
  `window` during render.
- Files under ~400 lines; split freely inside your folder. Never import from
  `#/prototypes`; never edit another area's folder.
- The shell renders every area's exports; placeholders exist so each area
  typechecks alone. Replace your `index.tsx` entirely.
- Real media: files the user drops are kept in memory (`src/editor/media`
  owns an `assetFiles` map + object URLs exposed via a small hook
  `useAssetUrl(assetId)` in `src/editor/media/files.ts`); nothing else
  persists them. After reload, assets fall back to their tint.
- Verify with `bunx tsc --noEmit -p tsconfig.json` (zero errors in your
  folder) and a headless render of `/editor/p1` (seeded project). Dev server
  runs at http://localhost:5173 already; never start another.
