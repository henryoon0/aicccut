# Editor core

Pure data + a tiny store for the OpenCut web editor. No UI here. Import from `#/editor/core`.

## Store shape

```ts
EditorState = {
  doc: Document,                 // project, assets, tracks, clips, bookmarks
  history: { past, future },     // Document snapshots, max 100
  selection: { clipIds },
  ripple, snapping, zoomPps,     // editing modes + timeline zoom (px/s)
  uiPanels: UiState,             // mediaPanel, inspector, palette, cheatsheet, safeAreas, grid, previewZoom, dialog, timelineWidth
}
```

`createEditorStore(doc)` returns `{ getState, setState, subscribe, mutateDoc, commit, undo, redo, replaceDoc, actions }`.
`actions` wraps every pure function in `document.ts` / `clip-props.ts`; every document action pushes history
unless called with a trailing `{ preview: true }`. Selection, ripple, snapping, zoom and UI actions never touch history.

## Preview / commit

Drag interactions call the same action many times. Pass `{ preview: true }` on each move: the document updates,
nothing is pushed. The first preview remembers the pre-drag document. Call `actions.commit()` on pointer-up to push
that snapshot once (no-op if nothing changed). Any non-preview action or undo commits a pending preview automatically.

## Time store vs React state

The playhead changes 60×/s. It lives in `TimeStore` (not the store). Components that animate subscribe with
`usePlayhead()` and write to the DOM; components that only display it use `useTime()` and re-render.
`Transport` (rAF clock, JKL rate, loop, in/out) drives the TimeStore; its rare state is in `useTransportState()`.

## Usage

```tsx
// 1. Select clips
const actions = useActions();
const { clipIds } = useSelection();
<div onClick={(e) => actions.select(clip.id, e.shiftKey)} />

// 2. Trim with preview + commit (pointer drag)
onPointerMove: (dx) => actions.trimClip(id, "end", dx / zoomPps, undefined, { preview: true });
onPointerUp:   () => actions.commit();

// 3. Evaluate a clip at the playhead
const time = usePlayhead();
useEffect(() => time.subscribe((t) => {
  const v = evaluateClip(clip, t);                    // { x, y, scale, rotation, opacity, blur }
  el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale / 100}) rotate(${v.rotation}deg)`;
}), [clip, time]);

// 4. Run a command (palette row click)
const ctx = useCommandContext();
const msg = runCommand("split", ctx);                 // "Split at 00:00:18.15"
useGlobalShortcuts(ctx, { onMessage: toast });        // install once, near the root

// 5. Subscribe the playhead to a DOM transform (no re-render)
const time = usePlayhead();
useEffect(() => time.subscribe((t) => { ref.current!.style.transform = `translateX(${t * zoomPps}px)`; }), [time, zoomPps]);

// 6. Autosave + boot
seedIfEmpty();                                         // once, client-side
const store = useMemo(() => createEditorStore(loadDocument(id) ?? newDocument({ name: "Untitled" })), [id]);
useAutosave(store);                                    // debounced saveDocument, flushed on unmount
<EditorProvider store={store}>…</EditorProvider>
```

## Modules

- `types.ts` data model · `seed.ts` sample data, fonts, effects, timecode helpers
- `animation.ts` easing, `interpolate`, `evaluateClip` · `document.ts` + `clip-props.ts` pure edits
- `time-store.ts`, `transport.ts` playback · `store.ts`, `actions.ts`, `context.ts` state + React bindings
- `persistence.ts` localStorage (`opencut.projects`, `opencut.doc.<id>`) · `shortcuts.ts`, `commands.ts` registry + keys

Units: seconds, canvas px, percent (scale/opacity, 100 = unchanged), degrees. Keyframe `time` is clip-relative.
