# Phase 3 — Stage 4: Cardinality & DataType Enforcement

> Enforce single/multi cardinality and dataType compatibility at connect time with user-visible feedback.
> Status: `[ ]` not started · **Effort**: 10h

## Steps

- [x] **Step 1**: Enforce `single` cardinality
  - File(s): `src/domain/validation/connectionRules.ts` (extend), `tests/unit/domain/validation/connectionRules.cardinality.test.ts`
  - Contents: Target input with `cardinality: 'single'` and existing inbound edge → reject.
  - Test: 100% — rejection with specific error code; existing edge highlighted in UI.
  - Effort: 2h

- [x] **Step 2**: `multi` cardinality allows fan-in
  - File(s): `src/domain/validation/connectionRules.ts` (extend), `tests/unit/domain/validation/connectionRules.multi.test.ts`
  - Contents: Target with `cardinality: 'multi'` accepts any number of inbound edges.
  - Test: 100% — 5 edges into one multi input succeed.
  - Effort: 2h

- [ ] **Step 3**: DataType mismatch rejection message
  - File(s): `src/domain/validation/connectionRules.ts` (extend), `tests/unit/domain/validation/connectionRules.dataType.test.ts`
  - Contents: Matrix of 4 types × 4 types tested; reject message includes source and target types.
  - Test: 100% — each combination; message quality.
  - Effort: 3h

- [ ] **Step 4**: Required input indicator (red outline when unconnected)
  - File(s): `src/features/nodes/ports/InputHandle.tsx` (extend), `src/store/selectors/graphSelectors.ts` (extend), `tests/unit/features/nodes/ports/InputHandle.required.test.tsx`
  - Contents: Selector computes whether a required port has an inbound edge; handle applies `[data-missing="true"]` when missing.
  - Test: 100% — outline appears on unconnected required port; disappears when connected.
  - Effort: 2h

- [ ] **Step 5**: Phase 3 acceptance + score review
  - File(s): —
  - Contents: Walk exit criteria; score each step; update phase status row.
  - Effort: 1h

## Acceptance for Stage 4

- All 5 steps `[x]` with score ≥ 90.
- 100% unit coverage on updated validator.
- Phase 3 scored ≥ 90 overall.
