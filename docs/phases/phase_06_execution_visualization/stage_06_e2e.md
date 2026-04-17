# Phase 6 — Stage 6: Phase 6 E2E
> Playwright scripted runs covering success / error / loop / reduced-motion paths.
> Status: `[ ]` not started · **Effort**: 10h

## Steps

- [ ] **Step 1**: E2E — scripted 5-node run; each node shows running → success
  - File(s): `tests/e2e/run-workflow.spec.ts`
  - Contents: Mount editor with `FakeExecutionEventSource`; emit events through the test harness; assert visible badge state per node.
  - Test: Green.
  - Effort: 3h

- [ ] **Step 2**: E2E — error path; inspector opens with payload
  - File(s): `tests/e2e/run-workflow.spec.ts` (extend)
  - Contents: Emit `node.failed` with payload; click error badge; inspector shows event + payload.
  - Test: Green.
  - Effort: 3h

- [ ] **Step 3**: E2E — loop node iteration badge increments across 3 iterations
  - File(s): `tests/e2e/run-workflow.spec.ts` (extend)
  - Contents: Emit iteration events; assert badge displays 1/?, 2/?, 3/?.
  - Test: Green.
  - Effort: 2h

- [ ] **Step 4**: E2E — reduced-motion mode disables animations but keeps state indicators
  - File(s): `tests/e2e/run-workflow.spec.ts` (extend)
  - Contents: Run with `forcedColors` + `prefersReducedMotion` in Playwright context; assert static icons; no CSS animation class.
  - Test: Green.
  - Effort: 2h

## Acceptance for Stage 6
- All 4 steps `[x]` with score ≥ 90.
- Phase 6 scored ≥ 90 overall.
- Full E2E matrix green in nightly.
