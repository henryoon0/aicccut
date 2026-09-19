# Prototype surface — contract for variant authors

This folder is an **isolated exploration surface**. Nothing in `src/` outside
this folder may import from here, and variant authors touch **only**
`src/prototypes/steps/<slug>/`. Production routes (`/`, `/editor`) stay as-is.

## Where things go

```
src/prototypes/steps/<slug>/
  index.ts        exports `variants: VariantDef[]` — exactly 5, picker order
  <name>.tsx      one file per variant (kebab-case file, component named after the direction)
  shared.tsx      optional helpers shared only inside this step
```

`index.ts`:

```ts
import type { VariantDef } from "#/prototypes/types";
import { Quiet } from "./quiet";
// ...
export const variants: VariantDef[] = [
  { name: "Quiet", axis: "테두리 대신 여백으로 구분, 모션 최소", when: "매일 쓰는 도구라 눈이 쉬어야 할 때", cost: "기억에 덜 남음", component: Quiet },
  // 5 total
];
```

`VariantDef` (see `../types.ts`): `name` is one English word or two describing
the direction ("Quiet", "Editorial", "Dense", "Playful", "Spatial"), never
"Option A". `axis`/`when`/`cost` are Korean, one short sentence each. Set
`pickerPosition: "top"` if the variant puts UI at the bottom-center (dock,
toast stack, bottom sheet). Set `hasMotion: false` if nothing is worth
replaying.

## What a variant must be

- **Full-size, full context.** The component mounts in an `absolute inset-0`
  box under a 12px-tall harness header. Fill it: `className="h-full w-full"`.
  A panel-level step (timeline, inspector, media library…) renders a
  plausible editor around the focal panel — the other panels as quiet but
  realistic neighbours (dim preview frame, muted track strip), never blank
  grey boxes labelled "preview goes here".
- **Fully working.** Real state, real pointer interactions (drag, trim,
  scrub, resize, hover, keyboard), realistic content from `#/prototypes/mock`.
  No dead buttons, no lorem ipsum, no "imagine this".
- **Genuinely different.** Each of the 5 diverges on a *named axis*: layout,
  density, personality, motion story, interaction model. Two variants that
  differ only in colour or copy are one variant — replace one.
- **Client-safe.** The harness mounts variants on the client, but never
  touch `window`/`document` during render; use effects/refs.
- **Self-contained.** Put step-local state in the component. Don't write to
  localStorage (the harness owns it). Don't import from other steps.
- Keep each file under ~450 lines. Split into `shared.tsx` when needed.

## Stack you build on

- React 19, TypeScript strict (`noUnusedLocals`, `noUnusedParameters`).
- Tailwind v4 with shadcn tokens plus the **fluid** ladder:
  - Surfaces: `bg-surface-1` (page) … `bg-surface-8`; matching
    `shadow-surface-N`. Editor chrome ≈ surface-1/2, panels 2/3, popups 3+.
  - Interaction: `bg-hover`, `bg-active`, `bg-selected`, `text-destructive`,
    `bg-destructive-light`.
  - `<Elevated offset={2}>` from `#/lib/elevated` wraps popovers/menus so
    nesting walks up the ladder automatically. Dialogs use offset 4.
  - Tokens: `text-foreground`, `text-muted-foreground`, `border-border`,
    `bg-background`, `rounded-md/lg/xl`.
- Motion: `framer-motion` (import from "framer-motion") with tiers from
  `#/lib/springs` (`spring.fast | moderate | slow`). CSS transitions fine for
  hover. Respect `prefers-reduced-motion` (Tailwind `motion-reduce:`).
- Icons: `@hugeicons/react` `<HugeiconsIcon icon={X} size={16} strokeWidth={1.5} />`
  with icons from `@hugeicons/core-free-icons` (project default), or
  `lucide-react` (fluid components' default). Either is fine; be consistent
  within a variant.
- Fonts: `font-sans` = Inter Variable; `font-heading` = Playfair Display
  (only if the direction calls for it). Use `tabular-nums` on timecodes.

### Fluid components (`#/components/ui/*`) — installed from `@fluid`

Read the file header comments when unsure; they document props.

| Import | Key props |
| --- | --- |
| `Button` (button.tsx) | `variant: "primary"\|"secondary"\|"tertiary"\|"ghost"`, `size: "default"\|"compact"\|"icon"\|"icon-compact"`, `leadingIcon`, `trailingIcon`, `loading`, `active` |
| `Tabs, TabsList, TabItem, TabPanel` (tabs.tsx) | segmented control, `value`/`onValueChange`; `TabItem value label icon?` |
| `TabsSubtle, TabsSubtleItem, TabsSubtlePanel` (tabs-subtle.tsx) | underline tabs |
| `Slider, SliderComfortable` (slider.tsx) | `value`, `onChange`, `min max step`, `variant: "pips"\|"scrubber"`, `showValue`, range with array value |
| `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose` (dialog.tsx) | Radix Dialog with spring transitions |
| `Select, SelectTrigger, SelectContent, SelectItem, SelectGroup, SelectLabel` (select.tsx) | `value`, `onValueChange`, `size` |
| `Dropdown, DropdownMenu, DropdownTrigger, DropdownContent, DropdownLabel, DropdownSeparator, DropdownSearch` (dropdown.tsx) + `MenuItem` (menu-item.tsx) | menus with fluid hover |
| `Tooltip` (tooltip.tsx) | `<Tooltip content="…" side="bottom"><button/></Tooltip>` — child is one element |
| `Switch` (switch.tsx) | `label`, `checked`, `onToggle`, `size` |
| `ScrollArea, ScrollBar` (scroll-area.tsx) | overlay scrollbar |
| `Combobox…` (combobox.tsx) | type-to-filter, multiple |
| `CheckboxGroup, CheckboxItem` / `RadioGroup, RadioItem` | grouped, merged selection |
| `Accordion…` (accordion.tsx) | animated height |
| `ColorPicker, ColorPickerPopover, ColorSwatch` (color-picker.tsx) | `value`, `onValueChange`, `swatches`, `format` |
| `CommandMenu` (command-menu.tsx) | `items: CommandMenuItemData[]`, `onSelect`, `query`; `parseShortcut/formatShortcut` helpers |
| `InputGroup, InputField` (input-group.tsx) | `InputField label index icon placeholder` |
| `Badge` (badge.tsx) | `variant`, `color`, `size` |
| `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardMedia, CardEyebrow, CardButton` (card.tsx) | `onClick`, `selected`, `dismissible` |
| `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` (table.tsx) | fluid row hover |

Legacy shadcn files also exist (`input.tsx`, `textarea.tsx`, `popover.tsx`,
`context-menu.tsx`, `resizable.tsx`, `kbd.tsx`, `separator.tsx`,
`progress.tsx`, `toggle-group.tsx`, `dropdown-menu.tsx`, `hover-card.tsx`,
`sheet.tsx`, `drawer.tsx`, `skeleton.tsx`, `empty.tsx`, `item.tsx`) — use
them when fluid has no equivalent (e.g. `resizable.tsx` for split panes,
`context-menu.tsx` for right-click menus, `kbd.tsx` for shortcut chips).
They are Base UI–flavoured; check their exports before importing.

Prefer fluid where both exist. Using fluid components is the point of this
exercise — the brief is "improve the overall UI with @fluid".

## Mock data (`#/prototypes/mock`)

`PROJECTS`, `ASSETS`, `TRACKS`, `CLIPS`, `PROJECT_DURATION`, `FONTS`,
`BLEND_MODES`, `EFFECTS`, `COMMANDS`, plus `timecode()`, `shortDuration()`,
`fileSize()`, `relativeTime()`. Where a thumbnail would be, use the item's
`tint` as a solid/gradient fill — no external images.

## Craft bar (Emil Kowalski)

- Entrances `ease-out`, never `ease-in`. UI motion under 300ms. Animate
  `transform`/`opacity` only; correct `transform-origin` for popups.
- Hover/press feedback on every interactive element; visible focus ring.
- Things used 100×/session (switching clips, scrubbing) get *no* animation.
- Density is a design decision, not an accident: set it per variant.
- Copy is product copy (English UI labels; Korean content from mock is fine).

## Verify before you finish

1. `bunx tsc --noEmit -p tsconfig.json` from `apps/web` — zero errors in your files.
2. Dev server is already running at http://localhost:5173 — do **not** start
   another one. `curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/prototypes/<slug>?v=1"`
   must be 200, and the dev log at
   `/private/tmp/claude-501/-Users-henry-Desktop-workspace-opencut/83b97b82-e64b-4a0e-a2f5-082a798087ce/scratchpad/dev.log`
   must show no new errors for your step.
3. Do not commit. Do not edit files outside your step folder.
