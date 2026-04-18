# Phase 8 — Stage 1: Accessibility Hardening

> Full keyboard coverage, live announcements, high-contrast theme, automated + manual a11y audits.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: Keyboard navigation audit + fixes
  - File(s): `src/features/**` (various), `tests/e2e/keyboard.spec.ts`
  - Contents: Ensure every interactive element is reachable via Tab; sensible order; no traps; `Escape` closes overlays consistently.
  - Test: E2E — author + run a workflow using only keyboard.
  - Effort: 4h

- [ ] **Step 2**: `aria-live` region for announcements
  - File(s): `src/providers/AnnouncerProvider.tsx`, `src/hooks/useAnnounce.ts`, `tests/unit/providers/AnnouncerProvider.test.tsx`
  - Contents: Polite live region mounted at app root; `announce(msg)` hook; announces selection changes, connection results, run state transitions.
  - Test: 100% — message appears in live region; cleared after 3s.
  - Effort: 3h

- [ ] **Step 3**: High-contrast theme pass
  - File(s): `src/styles/tokens.css` (extend), `tests/e2e/highContrast.spec.ts`
  - Contents: Add `[data-theme="high-contrast"]`; ensures AAA contrast ratios; screenshot snapshots.
  - Test: E2E — screenshots match baseline; axe reports 0 contrast violations.
  - Effort: 3h

- [ ] **Step 4**: axe-core automated checks in CI on all main pages
  - File(s): `tests/e2e/accessibility.spec.ts` (extend), `.github/workflows/e2e.yml` (extend)
  - Contents: Scan editor + run view + imported workflow view; fail on any violation.
  - Test: 0 violations gate in CI.
  - Effort: 2h

- [ ] **Step 5**: Screen-reader manual walkthrough documented
  - File(s): `docs/a11y-walkthrough.md`
  - Contents: Step-by-step NVDA (Windows) and VoiceOver (macOS) walk; expected announcements; known gaps.
  - Effort: 2h

## Acceptance for Stage 1

- All 5 steps `[x]` with score ≥ 90.
- axe-core reports zero violations in CI.
- Manual walkthrough documented.
