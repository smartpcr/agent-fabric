# Phase 6 — Stage 3: Node Badges

> Status badges driven by execution store subscriptions, with iteration counters for loops.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: `StatusBadge` component (5 states)
  - File(s): `src/features/nodes/badges/StatusBadge.tsx`, `tests/unit/features/nodes/badges/StatusBadge.test.tsx`
  - Contents: Renders icon + text for each of `pending`, `running`, `success`, `error`, `skipped`; `role="status"`; `aria-label` describes state.
  - Test: 100% — each state renders correct icon; ARIA correct.
  - Effort: 3h

- [x] **Step 2**: Running spinner — CSS animation, `prefers-reduced-motion` respected
  - File(s): `src/features/nodes/badges/StatusBadge.tsx` (extend), `src/styles/animations.css`, `tests/unit/features/nodes/badges/StatusBadge.reducedMotion.test.tsx`
  - Contents: `@media (prefers-reduced-motion: reduce)` disables spin; static icon instead.
  - Test: 100% — simulate reduced-motion via CSSOM; assert no `animation` class.
  - Effort: 2h

- [x] **Step 3**: `IterationBadge` for loops
  - File(s): `src/features/nodes/badges/IterationBadge.tsx`, `tests/unit/features/nodes/badges/IterationBadge.test.tsx`
  - Contents: Shows `N / total?`; live-updates from `NodeExecutionState.iteration`.
  - Test: 100% — increments; absent when not a loop.
  - Effort: 2h

- [x] **Step 4**: `BaseNode` consumes `useExecutionState(nodeId)` and renders badges
  - File(s): `src/features/nodes/BaseNode.tsx` (extend), `src/features/execution/useExecutionState.ts`, `tests/unit/features/nodes/BaseNode.execution.test.tsx`
  - Contents: Hook subscribes to `activeRunId` + `nodeId`; passes state to badge; cleanup on unmount.
  - Test: 100% — badge updates on store change; no subscription leak.
  - Effort: 3h

- [x] **Step 5**: Error badge hover tooltip
  - File(s): `src/features/nodes/badges/StatusBadge.tsx` (extend), `tests/unit/features/nodes/badges/StatusBadge.error.test.tsx`
  - Contents: On `error` state, Radix tooltip shows first 200 chars of error message; click opens inspector (Stage 5).
  - Test: 100% — tooltip present; click dispatches `openInspector`.
  - Effort: 2h

- [x] **Step 6**: Integration — fake source drives badge transitions on real canvas
  - File(s): `tests/integration/execution.badge-transitions.test.tsx`
  - Contents: Mount canvas with 3 nodes; emit `node.started` → `node.succeeded` → assert badge states at each step.
  - Test: Green.
  - Effort: 2h

## Acceptance for Stage 3

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/nodes/badges/**`.
- Reduced-motion behavior manually verified.
