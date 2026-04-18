# Phase 6 — Stage 4: Edge Animation

> CSS-based edge animations driven by execution edge states, including loop-back pulse, with a performance budget.
> Status: `[x]` done · **Effort**: 14h

## Steps

- [x] **Step 1**: `DefaultEdge` reads `useEdgeExecutionState(id)`
  - File(s): `src/features/edges/DefaultEdge.tsx` (extend), `src/features/execution/useEdgeExecutionState.ts`, `tests/unit/features/edges/DefaultEdge.execution.test.tsx`
  - Contents: Selector-backed subscription; edge re-renders on state change only (not on graph state).
  - Test: 100% — re-renders only on own state change.
  - Effort: 2h

- [x] **Step 2**: Flowing-dash animation (`stroke-dashoffset`)
  - File(s): `src/features/edges/edgeAnimations.css`, `src/features/edges/DefaultEdge.tsx` (extend), `tests/unit/features/edges/DefaultEdge.dashAnimation.test.tsx`
  - Contents: `@keyframes flow { to { stroke-dashoffset: -16 } }`; applied on `state.status === 'active'`; respects reduced-motion.
  - Test: 100% — class applied/removed; reduced-motion opts out.
  - Effort: 3h

- [x] **Step 3**: Flash on success/error
  - File(s): `src/features/edges/edgeAnimations.css` (extend), `src/features/edges/DefaultEdge.tsx` (extend), `tests/unit/features/edges/DefaultEdge.flash.test.tsx`
  - Contents: Brief stroke-color transition (500ms green / red); one-shot via CSS animation + `animation-fill-mode: forwards`.
  - Test: 100% — class applied on state transition; removed after animation.
  - Effort: 2h

- [x] **Step 4**: "Not taken" edges dim
  - File(s): `src/features/edges/DefaultEdge.tsx` (extend), `tests/unit/features/edges/DefaultEdge.notTaken.test.tsx`
  - Contents: On `state.status === 'not-taken'`, reduce opacity and desaturate.
  - Test: 100% — opacity + filter applied.
  - Effort: 1h

- [x] **Step 5**: Loop-back pulse variant
  - File(s): `src/features/edges/LoopBackEdge.tsx` (extend), `tests/unit/features/edges/LoopBackEdge.pulse.test.tsx`
  - Contents: Distinct pulse animation on iteration boundary.
  - Test: 100% — class applied on `iteration` increments.
  - Effort: 2h

- [x] **Step 6**: Performance benchmark — 200-node graph, 20 ev/sec, p95 < 16ms
  - File(s): `tests/integration/execution.perf.test.ts`, `tests/performance/execution.bench.ts`
  - Contents: Simulate 20 events per second for 10 seconds; measure frame times via `performance.now()`; fail if p95 > 16ms.
  - Test: Benchmark passes on CI.
  - Effort: 4h

## Acceptance for Stage 4

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on edge rendering + animations.
- Performance benchmark within budget.
