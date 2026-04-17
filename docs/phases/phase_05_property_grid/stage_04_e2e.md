# Phase 5 — Stage 4: Phase 5 E2E
> Playwright scenarios covering property-grid editing, validation, arrays, multi-select, and accessibility.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [ ] **Step 1**: E2E — edit string field, reload, value persists
  - File(s): `tests/e2e/property-grid.spec.ts`
  - Contents: Select a node; edit `name`; wait for debounce + autosave; reload; assert value restored.
  - Test: Green.
  - Effort: 3h

- [ ] **Step 2**: E2E — invalid number field; Save disabled; correct re-enables
  - File(s): `tests/e2e/property-grid.spec.ts` (extend)
  - Contents: Force invalid; assert error visible; Save button `aria-disabled="true"`; correction clears error.
  - Test: Green.
  - Effort: 3h

- [ ] **Step 3**: E2E — array field (add, remove, reorder)
  - File(s): `tests/e2e/property-grid.spec.ts` (extend)
  - Contents: Work with a TaskNode's `params` array; add 3 items; remove middle; drag to reorder; verify order.
  - Test: Green.
  - Effort: 3h

- [ ] **Step 4**: E2E — multi-select editing
  - File(s): `tests/e2e/property-grid.spec.ts` (extend)
  - Contents: Select 2 TaskNodes; edit common field; both update.
  - Test: Green.
  - Effort: 3h

- [ ] **Step 5**: Phase 5 acceptance + score review
  - File(s): —
  - Contents: Walk exit criteria; update phase status row.
  - Effort: 2h

## Acceptance for Stage 4
- All 5 steps `[x]` with score ≥ 90.
- Phase 5 scored ≥ 90 overall.
- E2E matrix green.
