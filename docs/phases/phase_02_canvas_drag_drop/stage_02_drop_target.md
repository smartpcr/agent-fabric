# Phase 2 — Stage 2: Drop Target & Node Creation
> Accept palette drops on the canvas, convert coordinates, preview a ghost, snap to grid, and wire undo.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [ ] **Step 1**: Canvas accepts pointer drops and reads drag payload
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/unit/features/canvas/Canvas.onDrop.test.tsx`
  - Contents: `onPointerUp` on the wrapper checks `DragContext`; if a payload is present, calls `addNode(kind, position)`; clears the payload.
  - Test: 100% — drop fires `addNode` with the payload kind.
  - Effort: 3h

- [ ] **Step 2**: Convert client coordinates to flow coordinates
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/unit/features/canvas/coordinates.test.ts`
  - Contents: Use `useReactFlow().screenToFlowPosition({x, y})` taking bounding rect into account; handles zoom and pan correctly.
  - Test: 100% — given mocked viewport `{x: 100, y: 200, zoom: 2}`, drop at client `(300, 400)` maps to expected flow coords within 1px.
  - Effort: 2h

- [ ] **Step 3**: Ghost preview during drag
  - File(s): `src/features/palette/DragGhost.tsx`, `tests/unit/features/palette/DragGhost.test.tsx`
  - Contents: Portal to `<body>`; position follows pointer via `pointermove`; hidden when not dragging; shows icon + label.
  - Test: 100% — mount/unmount with drag state; position updates.
  - Effort: 3h

- [ ] **Step 4**: Reject drops outside canvas bounds
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/unit/features/canvas/Canvas.dropOutside.test.tsx`
  - Contents: Drop target is the canvas wrapper; releases elsewhere do nothing; DragContext is still cleared.
  - Test: 100% — drop on palette is a no-op; no `addNode` dispatch.
  - Effort: 1h

- [ ] **Step 5**: Snap-to-grid on drop (when enabled)
  - File(s): `src/features/canvas/SnapGrid.ts`, `src/store/slices/viewportSlice.ts` (extend), `tests/unit/features/canvas/SnapGrid.test.ts`
  - Contents: `snapToGrid(pos, size=16)` rounds to nearest multiple; `viewportSlice.snapEnabled: boolean` toggled from Controls; applied in `Canvas.onDrop` when enabled.
  - Test: 100% — rounding behavior; disabled bypasses; grid size configurable.
  - Effort: 2h

- [ ] **Step 6**: Undo creates-via-drop
  - File(s): `tests/integration/canvas.drop-undo.test.tsx`
  - Contents: Wire with temporal middleware (already present from Phase 0); test drops → undo → node gone.
  - Test: Green in CI.
  - Effort: 1h

- [ ] **Step 7**: Integration — palette drag → canvas drop → node rendered
  - File(s): `tests/integration/editor.drag-drop.test.tsx`
  - Contents: Mount `EditorPage` with registered builtins; simulate pointer drag from palette to canvas; assert node rendered at drop point.
  - Test: Green in CI.
  - Effort: 2h

## Acceptance for Stage 2
- All 7 steps `[x]` with score ≥ 90.
- 100% unit coverage on touched files.
- Drop works on Chromium, Firefox, WebKit in Playwright.
