# Phase 6 — Stage 2: Execution State Store

> Store slice + reducer that accepts event streams, enforces transitions, batches by animation frame.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: `executionSlice` state shape
  - File(s): `src/store/slices/executionSlice.ts` (extend), `tests/unit/store/slices/executionSlice.init.test.ts`
  - Contents: `runs: Map<runId, { nodes: Map<nodeId, NodeExecutionState>, edges: Map<edgeId, EdgeExecutionState>, status, startedAt, finishedAt? }>`; `activeRunId?: string`.
  - Test: 100% — initial empty; `setActiveRun` / `clearRun`.
  - Effort: 3h

- [ ] **Step 2**: `applyEvent(state, event)` reducer
  - File(s): `src/store/slices/executionSlice.ts` (extend), `tests/unit/store/slices/executionSlice.applyEvent.test.ts`
  - Contents: Updates node/edge maps based on event type; creates run entry on `run.started`; sets `finishedAt` on terminal run events.
  - Test: 100% — each event type mutates expected fields; unknown event logs warning and no-ops.
  - Effort: 3h

- [x] **Step 3**: Transition guards
  - File(s): `src/store/slices/executionSlice.ts` (extend), `tests/unit/store/slices/executionSlice.transitions.test.ts`
  - Contents: Illegal transitions (e.g. `succeeded` without `started`) dropped with `console.warn`; table-driven legal transitions.
  - Test: 100% — illegal transitions ignored; state unchanged; warning logged (spied).
  - Effort: 2h

- [ ] **Step 4**: RAF coalescing batcher
  - File(s): `src/utils/rafBatcher.ts`, `tests/unit/utils/rafBatcher.test.ts`
  - Contents: `createRafBatcher<T>(apply: (batch: T[]) => void)` queues items; flushes once per animation frame via `requestAnimationFrame`; cleanup on flush.
  - Test: 100% — 100 queued items in one frame → 1 `apply` call; cancel on teardown.
  - Effort: 3h

- [ ] **Step 5**: Selectors for node/edge state
  - File(s): `src/store/selectors/executionSelectors.ts`, `tests/unit/store/selectors/executionSelectors.test.ts`
  - Contents: `selectNodeExecutionState(runId, nodeId)`, `selectEdgeExecutionState(runId, edgeId)`; memoize via `fast-equals`.
  - Test: 100% — stable reference across unrelated state changes.
  - Effort: 2h

- [ ] **Step 6**: Reset on new run; optional retention
  - File(s): `src/store/slices/executionSlice.ts` (extend), `tests/unit/store/slices/executionSlice.reset.test.ts`
  - Contents: `startRun(runId)` either clears prior runs (default) or retains them behind a flag.
  - Test: 100% — default behavior; retention flag preserves prior runs.
  - Effort: 1h

## Acceptance for Stage 2

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on execution store + batcher.
- Property test: 10k random event sequences never corrupt state.
