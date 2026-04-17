# Phase 2 — Stage 6: Phase 2 E2E
> Playwright scenarios exercising palette + canvas + selection + viewport + a11y.
> Status: `[ ]` not started · **Effort**: 12h

## Steps

- [ ] **Step 1**: E2E — drag Task from palette, drop on canvas, verify node renders
  - File(s): `tests/e2e/build-workflow.spec.ts`
  - Contents: Playwright drag simulation via pointer events; assert DOM node `[data-id]` matching the new id.
  - Test: Green on Chromium (on-PR) + matrix (nightly).
  - Effort: 3h

- [ ] **Step 2**: E2E — select + delete a node via keyboard
  - File(s): `tests/e2e/build-workflow.spec.ts` (extend)
  - Contents: Focus node with Tab; Delete; assert node is gone.
  - Test: Green.
  - Effort: 2h

- [ ] **Step 3**: E2E — pan/zoom/fit-view; viewport persists across reload
  - File(s): `tests/e2e/build-workflow.spec.ts` (extend)
  - Contents: Wheel zoom; click fit-view; reload page; assert viewport restored to same values.
  - Test: Green.
  - Effort: 3h

- [ ] **Step 4**: E2E — a11y audit (axe-core) on editor page
  - File(s): `tests/e2e/accessibility.spec.ts`
  - Contents: `@axe-core/playwright` scan of `/editor`; fail on any violations.
  - Test: 0 violations.
  - Effort: 2h

- [ ] **Step 5**: Phase 2 acceptance checklist + score review
  - File(s): — (manual)
  - Contents: Walk all Phase 2 exit criteria; score each step; update phase progress.
  - Effort: 2h

## Acceptance for Stage 6
- All 5 steps `[x]` with score ≥ 90.
- Phase 2 scored ≥ 90 overall.
- E2E matrix green (Chromium + Firefox + WebKit in nightly).
