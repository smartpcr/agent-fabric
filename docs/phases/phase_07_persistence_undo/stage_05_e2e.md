# Phase 7 — Stage 5: Phase 7 E2E
> Playwright scenarios for persistence + undo/redo round-trips.
> Status: `[ ]` not started · **Effort**: 4h

## Steps

- [ ] **Step 1**: E2E — build → save → reload → reopen → identical
  - File(s): `tests/e2e/persistence.spec.ts`
  - Contents: Author graph; save; reload page; reopen; assert node/edge count and properties match.
  - Test: Green.
  - Effort: 2h

- [ ] **Step 2**: E2E — 50 undo + 50 redo sequence ends at identical state
  - File(s): `tests/e2e/persistence.spec.ts` (extend)
  - Contents: 50 mutations captured; 50 undos restore initial state; 50 redos reach final state.
  - Test: Green.
  - Effort: 2h

## Acceptance for Stage 5
- Both steps `[x]` with score ≥ 90.
- Phase 7 E2E green in nightly matrix.
