# Phase 4 — Stage 3: Layout Engine (ELK)
> Adopt Eclipse Layout Kernel (WASM) for auto-layout with orthogonal back-edge routing.
> Status: `[ ]` not started · **Effort**: 22h

## Steps

- [ ] **Step 1**: Add `elkjs` dependency + loader shim
  - File(s): `src/domain/layout/elkLoader.ts`, `package.json`, `tests/unit/domain/layout/elkLoader.test.ts`
  - Contents: Lazy-loaded singleton; caches `ELK` instance; tests mock the WASM module so jsdom doesn't actually execute it.
  - Test: 100% — loader caches; mock returns a stub for jsdom.
  - Effort: 3h

- [ ] **Step 2**: `toElkGraph(graph)` adapter
  - File(s): `src/domain/layout/elkAdapter.ts`, `tests/unit/domain/layout/elkAdapter.toElk.test.ts`
  - Contents: Transform `WorkflowGraph` → ELK JSON (id, children, ports, edges, labels); maps port spec to ELK port constraints.
  - Test: 100% — nodes / edges / ports transformed; roundtrip safety.
  - Effort: 3h

- [ ] **Step 3**: `fromElkLayout(result, graph)` — back to positions
  - File(s): `src/domain/layout/elkAdapter.ts` (extend), `tests/unit/domain/layout/elkAdapter.fromElk.test.ts`
  - Contents: Apply ELK-produced `x, y` to each node; leave edges untouched.
  - Test: 100% — positions applied; empty graph is a no-op.
  - Effort: 2h

- [ ] **Step 4**: Layout options per strategy (`layered`, `force`, `radial`)
  - File(s): `src/domain/layout/layoutOptions.ts`, `tests/unit/domain/layout/layoutOptions.test.ts`
  - Contents: Map each strategy → ELK options object; default is `layered`.
  - Test: 100% — correct keys for each strategy.
  - Effort: 2h

- [ ] **Step 5**: Loop-back routing options
  - File(s): `src/domain/layout/layoutOptions.ts` (extend), `tests/unit/domain/layout/layoutOptions.loop.test.ts`
  - Contents: `edgeRouting: ORTHOGONAL`, `cycleBreaking.strategy: GREEDY`, `layered.considerModelOrder.strategy: NODES_AND_EDGES`.
  - Test: 100% — options include loop-relevant keys.
  - Effort: 3h

- [ ] **Step 6**: "Auto-layout" toolbar button; undoable
  - File(s): `src/features/editor/Toolbar.tsx` (extend), `src/store/slices/graphSlice.ts` (add `applyLayout` action), `tests/integration/layout.toolbar.test.tsx`
  - Contents: Click triggers `layoutGraph(strategy)`; wraps in a single undo step; disabled while running.
  - Test: Integration — click → positions change; one undo restores prior.
  - Effort: 2h

- [ ] **Step 7**: Incremental layout (only affected subgraph)
  - File(s): `src/domain/layout/incrementalLayout.ts`, `tests/unit/domain/layout/incrementalLayout.test.ts`, `tests/performance/layout.bench.ts`
  - Contents: Given a node change, compute minimum bounding subgraph and layout just that; benchmark target < 200ms for 100-node graph.
  - Test: Benchmark passes on CI hardware; correctness verified via fixture graphs.
  - Effort: 4h

- [ ] **Step 8**: E2E — auto-layout on 20-node mixed graph produces no overlap
  - File(s): `tests/e2e/auto-layout.spec.ts`
  - Contents: Scripted graph build; click auto-layout; assert node bounding boxes don't intersect.
  - Test: Green.
  - Effort: 3h

## Acceptance for Stage 3
- All 8 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/domain/layout/**`.
- Performance benchmark within budget.
- Phase 4 scored ≥ 90 overall.
