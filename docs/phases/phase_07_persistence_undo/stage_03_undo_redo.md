# Phase 7 — Stage 3: Undo / Redo

> Wire zundo temporal middleware, group drag updates, add keyboard shortcuts, prove 50-step chain.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: `zundo` middleware wired in `createStore`
  - File(s): `src/store/createStore.ts` (extend), `tests/unit/store/createStore.temporal.test.ts`
  - Contents: `temporal(immer(...), { limit: 50 })`; expose `useWorkflowStore.temporal.getState().undo()` / `.redo()`.
  - Test: 100% — undo / redo actions present; limit enforced.
  - Effort: 2h

- [x] **Step 2**: `partialize` records only graph slice
  - File(s): `src/store/createStore.ts` (extend), `tests/unit/store/createStore.partialize.test.ts`
  - Contents: `partialize: s => ({ nodes: s.nodes, edges: s.edges })`; selection/execution/viewport excluded.
  - Test: 100% — selection toggle does not create a history entry.
  - Effort: 2h

- [x] **Step 3**: Group consecutive drag-position updates into one history entry
  - File(s): `src/store/historyGroup.ts`, `src/store/createStore.ts` (extend), `tests/unit/store/historyGroup.test.ts`
  - Contents: Pending-timer debouncer (200ms idle) that coalesces position updates; one undo reverses entire drag.
  - Test: 100% — drag of 20 position changes → 1 history step.
  - Effort: 3h

- [x] **Step 4**: `UndoRedoButtons` toolbar + disabled states
  - File(s): `src/features/history/UndoRedoButtons.tsx`, `tests/unit/features/history/UndoRedoButtons.test.tsx`
  - Contents: Icons + tooltips; disabled when no history / no future.
  - Test: 100%.
  - Effort: 2h

- [ ] **Step 5**: Keyboard shortcuts (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl+Y)
  - File(s): `src/features/history/useHistoryShortcut.ts`, `tests/unit/features/history/useHistoryShortcut.test.ts`
  - Contents: Global listener that ignores when focus is inside input/textarea/contenteditable.
  - Test: 100% — fires outside inputs; suppressed inside.
  - Effort: 3h

- [ ] **Step 6**: 50-step chain integration
  - File(s): `tests/integration/history.50-steps.test.tsx`
  - Contents: Perform 50 mutations; undo 50 times; assert initial state; redo 50 times; assert final state.
  - Test: Green.
  - Effort: 2h

## Acceptance for Stage 3

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on history helpers + shortcuts.
