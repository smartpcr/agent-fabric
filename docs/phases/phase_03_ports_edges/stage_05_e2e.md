# Phase 3 — Stage 5: Phase 3 E2E
> Playwright scenarios for ports and connections.
> Status: `[ ]` not started · **Effort**: 6h

## Steps

- [ ] **Step 1**: E2E — drag connection between valid ports; edge rendered
  - File(s): `tests/e2e/ports-edges.spec.ts`
  - Contents: Drag from output handle to compatible input; assert edge path in DOM.
  - Test: Green.
  - Effort: 2h

- [ ] **Step 2**: E2E — invalid drop triggers rejection toast
  - File(s): `tests/e2e/ports-edges.spec.ts` (extend)
  - Contents: Drag to incompatible handle; release; assert toast with rejection message.
  - Test: Green.
  - Effort: 2h

- [ ] **Step 3**: E2E — keyboard-only connection path
  - File(s): `tests/e2e/ports-edges.spec.ts` (extend)
  - Contents: Tab to output handle; Enter to enter connect mode; arrow keys to target; Enter to commit; assert new edge.
  - Test: Green.
  - Effort: 2h

## Acceptance for Stage 5
- All 3 steps `[x]` with score ≥ 90.
- Phase 3 E2E green in Chromium + nightly matrix.
