# Phase 2 — Stage 5: Viewport & Controls

> Pan, zoom, fit-view, mini-map, grid background, snap toggle, and per-workflow viewport persistence.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: Pan / zoom (wheel + middle-drag; pinch on touch)
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/unit/features/canvas/Canvas.panzoom.test.tsx`
  - Contents: xyflow handles wheel + pinch natively; configure `panOnScroll`, `zoomOnPinch`, `minZoom`, `maxZoom`.
  - Test: 100% — synthetic wheel event adjusts `viewport.zoom`; pan via middle-drag.
  - Effort: 3h

- [x] **Step 2**: `MiniMap` with clickable navigation
  - File(s): `src/features/canvas/MiniMap.tsx`, `tests/unit/features/canvas/MiniMap.test.tsx`
  - Contents: xyflow `<MiniMap/>` with custom node-color function (by kind); click on mini-map recenters viewport.
  - Test: 100% — renders; click dispatches `setViewport`.
  - Effort: 2h

- [x] **Step 3**: Controls toolbar (zoom in/out, fit-view, lock)
  - File(s): `src/features/canvas/Controls.tsx`, `tests/unit/features/canvas/Controls.test.tsx`
  - Contents: Buttons dispatch `zoomIn`, `zoomOut`, `fitView`, `toggleInteractive`. Tooltip + keyboard shortcuts (`+`, `-`, `f`, `l`).
  - Test: 100% — each button dispatches correctly; shortcuts firing in canvas only.
  - Effort: 3h

- [x] **Step 4**: Background grid + snap-grid toggle
  - File(s): `src/features/canvas/Background.tsx` (extend), `src/features/editor/Toolbar.tsx` (new), `tests/unit/features/canvas/Background.test.tsx`
  - Contents: Toggle button in toolbar; state in `viewportSlice.snapEnabled`; grid pattern changes from dots → lines when snap on.
  - Test: 100% — toggle flips state; pattern changes.
  - Effort: 2h

- [ ] **Step 5**: Viewport persistence per workflow (restore on load)
  - File(s): `src/store/slices/viewportSlice.ts` (extend), `src/features/persistence/useAutoSave.ts` (stub wiring), `tests/integration/viewport.persist.test.tsx`
  - Contents: `viewportSlice` persists `{x, y, zoom}`; included in saved graph payload; on load, `useReactFlow().setViewport(...)` restores.
  - Test: Integration — set viewport → save → restore → viewport matches.
  - Effort: 2h

- [ ] **Step 6**: Integration — build 3-node chain via palette + canvas interactions
  - File(s): `tests/integration/editor.build-graph.test.tsx`
  - Contents: User-flow — drag Start, Task, End; connect via ports (uses Phase 3 handles); assert graph shape.
  - Test: Green in CI.
  - Effort: 2h

## Acceptance for Stage 5

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on touched files.
- Keyboard shortcuts for zoom/fit/lock work.
