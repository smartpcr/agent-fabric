# Phase 2 — Stage 4: Selection & Deletion

> Single and multi-select (shift, lasso) + keyboard deletion wired to undo.
> Status: `[x]` complete · **Effort**: 12h

## Steps

- [x] **Step 1**: `selectionSlice` actions
  - File(s): `src/store/slices/selectionSlice.ts` (extend), `tests/unit/store/slices/selectionSlice.test.ts`
  - Contents: `selected: Set<string>` (node ids); actions `select(id, mode: 'replace'|'add'|'toggle')`, `selectMany(ids)`, `clear()`; selector `isSelected(id)`.
  - Test: 100% — each action; de-duplication; clear.
  - Effort: 3h

- [x] **Step 2**: Click selects; shift-click adds; ctrl/cmd-click toggles
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/integration/selection.click.test.tsx`
  - Contents: xyflow `onSelectionChange` routed through store; modifier keys detected.
  - Test: Integration — click / shift-click / ctrl-click behave as spec.
  - Effort: 2h

- [x] **Step 3**: Lasso (box) selection
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/integration/selection.lasso.test.tsx`
  - Contents: xyflow `selectionMode="partial"`; drag on empty canvas creates box; all intersecting nodes selected on release.
  - Test: Integration — box encloses 2 of 3 nodes; those 2 become selected.
  - Effort: 3h

- [x] **Step 4**: Delete / Backspace removes selected nodes + edges; undoable
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `src/store/slices/graphSlice.ts` (extend), `tests/integration/selection.delete.test.tsx`
  - Contents: Listener on canvas; batches `removeNode` for each selected; single undo step restores all.
  - Test: Integration — 2 nodes selected + Delete → both removed; undo restores.
  - Effort: 2h

- [x] **Step 5**: Escape clears selection (scoped)
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/unit/features/canvas/Canvas.escape.test.tsx`
  - Contents: Listener scoped to canvas element (not global `document`) to avoid interfering with modals/inputs.
  - Test: Unit — escape in canvas clears; escape while focus is in property grid does not.
  - Effort: 2h

## Acceptance for Stage 4

- All 5 steps `[x]` with score ≥ 90.
- 100% unit coverage on touched files.
- Deletion is undoable in a single step.
