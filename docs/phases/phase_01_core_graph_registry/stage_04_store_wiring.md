# Phase 1 — Stage 4: Store Wiring for Domain

> Fill in the zustand `graphSlice` + `registrySlice` with validated actions and selectors. Provide test utilities.
> Status: `[ ]` not started · **Effort**: 20h

## Steps

- [x] **Step 1**: `graphSlice`: state + `addNode` action
  - File(s): `src/store/slices/graphSlice.ts` (extend), `tests/unit/store/slices/graphSlice.addNode.test.ts`
  - Contents: `nodes: WorkflowNode[]`, `edges: WorkflowEdge[]`; `addNode(spec, position?) → WorkflowNode` uses `makeNode`; returns the new node.
  - Test: 100% — starts empty; `addNode` appends; returned node matches state.
  - Effort: 2h

- [x] **Step 2**: `graphSlice`: `removeNode` (cascading edges)
  - File(s): `src/store/slices/graphSlice.ts` (extend), `tests/unit/store/slices/graphSlice.removeNode.test.ts`
  - Contents: Remove node by id; drop all edges where `source === id || target === id`.
  - Test: 100% — missing id is no-op; edges cascade.
  - Effort: 2h

- [x] **Step 3**: `graphSlice`: `connectPorts(conn): Result<WorkflowEdge, ConnectionInvalidError>`
  - File(s): `src/store/slices/graphSlice.ts` (extend), `tests/unit/store/slices/graphSlice.connectPorts.test.ts`
  - Contents: Runs `validateConnection` against current state + registry; on success, appends `WorkflowEdge`; on failure, returns `Result.err` and does not mutate state.
  - Test: 100% — valid connect appends; invalid returns error; state unchanged on failure.
  - Effort: 3h

- [x] **Step 4**: `graphSlice`: `updateNodeData(id, newData): Result<void, ValidationError[]>`
  - File(s): `src/store/slices/graphSlice.ts` (extend), `tests/unit/store/slices/graphSlice.updateNodeData.test.ts`
  - Contents: Validates via `validateNodeData`; on success, replaces `node.data`; on failure, returns errors; state unchanged.
  - Test: 100% — valid update persists; invalid returns errors; no mutation on failure.
  - Effort: 2h

- [x] **Step 5**: `graphSlice`: `updateNodePosition` (high-frequency, unvalidated)
  - File(s): `src/store/slices/graphSlice.ts` (extend), `tests/unit/store/slices/graphSlice.updateNodePosition.test.ts`
  - Contents: Sets position; clamps non-finite to 0; used by drag.
  - Test: 100% — happy path; NaN/Infinity clamp.
  - Effort: 2h

- [x] **Step 6**: `graphSlice`: bulk `applyNodeChanges` / `applyEdgeChanges` (xyflow change shapes)
  - File(s): `src/store/slices/graphSlice.ts` (extend), `tests/unit/store/slices/graphSlice.applyChanges.test.ts`
  - Contents: Handles the 5 change kinds — `add`, `remove`, `position`, `select`, `dimensions`. Routes each to the right action/state update.
  - Test: 100% — one test per kind; mixed batch applies correctly.
  - Effort: 3h

- [x] **Step 7**: `registrySlice`: holds `NodeRegistry` reference + selectors
  - File(s): `src/store/slices/registrySlice.ts` (extend), `src/store/selectors/graphSelectors.ts`, `tests/unit/store/slices/registrySlice.test.ts`
  - Contents: `registry: NodeRegistry`; `selectNodeSpec(kind)` memoized via `fast-equals`; action `setRegistry(r)` for tests.
  - Test: 100% — resolves spec; memoization keeps reference stable across unrelated state changes.
  - Effort: 2h

- [x] **Step 8**: Store snapshot + restore test utilities
  - File(s): `src/store/testUtils.ts`, `tests/unit/store/testUtils.test.ts`
  - Contents: `snapshotGraph(store)` returns plain JSON (graph only); `restoreGraph(store, json)` re-hydrates; used by undo/redo tests later.
  - Test: 100% — snapshot → restore → deep-equal.
  - Effort: 2h

- [x] **Step 9**: Integration — store + registry + validation end-to-end
  - File(s): `tests/integration/store.graph-mutations.test.ts`
  - Contents: Register builtins → add nodes via store actions → connect valid + reject invalid → final snapshot matches fixture.
  - Test: Green in CI.
  - Effort: 2h

## Acceptance for Stage 4

- All 9 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/store/**`.
- Integration test green.
- Phase 1 scored ≥ 90 overall.
