# Phase 5 — Stage 3: Property Grid Integration

> Wire the SchemaForm to the selected node, handle undo/redo re-hydration, multi-select editing, and validation gating.
> Status: `[ ]` not started · **Effort**: 20h

## Steps

- [x] **Step 1**: `PropertyGrid` binds to `selectionSlice.lastSelectedNodeId`
  - File(s): `src/features/property-grid/PropertyGrid.tsx` (upgrade placeholder), `tests/unit/features/property-grid/PropertyGrid.test.tsx`
  - Contents: Reads selection → resolves spec → renders `SchemaForm` for `node.data`; empty state "Select a node".
  - Test: 100% — empty state; switches on selection change.
  - Effort: 3h

- [x] **Step 2**: Header: node kind, label (editable), id (read-only)
  - File(s): `src/features/property-grid/PropertyGridHeader.tsx`, `tests/unit/features/property-grid/PropertyGridHeader.test.tsx`
  - Contents: Kind as badge; label inline-editable (commits via `updateNodeData({name})` for nodes that have `name`); id shown small + monospace with copy button.
  - Test: 100% — label edit; id read-only; copy id.
  - Effort: 2h

- [x] **Step 3**: Form re-renders on external store changes (undo/redo)
  - File(s): `src/features/property-grid/SchemaForm.tsx` (extend), `tests/integration/property-grid.undo-redo.test.tsx`
  - Contents: Effect detects `value` prop change → `reset()` on the `react-hook-form` instance; preserves focused field when possible.
  - Test: Integration — undo restores previous form values; focus preserved.
  - Effort: 3h

- [x] **Step 4**: Validation → inline errors + global Save gate
  - File(s): `src/features/property-grid/PropertyGrid.tsx` (extend), `src/features/editor/Toolbar.tsx` (extend), `tests/integration/property-grid.validation.test.tsx`
  - Contents: Error count badge; Save button disabled when any field invalid; error summary on hover.
  - Test: Integration — invalid field → Save disabled; correction re-enables.
  - Effort: 3h

- [x] **Step 5**: Multi-select — common fields; "mixed" indicator
  - File(s): `src/features/property-grid/PropertyGrid.tsx` (extend), `tests/integration/property-grid.multiselect.test.tsx`
  - Contents: When multiple nodes of same kind selected, compute common field values; differing fields render with "mixed" placeholder; edits apply to all.
  - Test: Integration — two TaskNodes selected; edit name applies to both.
  - Effort: 3h

- [x] **Step 6**: Accessibility — legend, `aria-describedby` for errors
  - File(s): `src/features/property-grid/SchemaForm.tsx` (extend), `tests/e2e/property-grid.a11y.spec.ts`
  - Contents: `<fieldset><legend>` for each object field; every input linked to its error message via `aria-describedby`; screen-reader announces validation changes.
  - Test: axe-core reports 0 violations on property grid panel.
  - Effort: 3h

- [x] **Step 7**: Integration — edit TaskNode `name`, verify `BaseNode` header updates
  - File(s): `tests/integration/property-grid.live-update.test.tsx`
  - Contents: Edit name via grid; after 300ms debounce, node header reflects the new value.
  - Test: Green.
  - Effort: 3h

## Acceptance for Stage 3

- All 7 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/property-grid/**`.
- Undo/redo + multi-select integration tests green.
