# Phase 4 — Stage 2: Loop Node

> While and for-each loop nodes with body ports, back-edges, and validator rules.
> Status: `[ ]` not started · **Effort**: 20h

## Steps

- [x] **Step 1**: `LoopNode` spec (while): in, body-out, body-in, done
  - File(s): `src/registry/builtins/LoopWhileNode.spec.ts`, `tests/unit/registry/builtins/LoopWhileNode.test.ts`
  - Contents: kind `'loop-while'`; ports `in` (input), `body-out` (output), `body-in` (input), `done` (output); `capabilities.canHaveBackEdge = true`; `propertySchema = z.object({ condition: z.string().min(1) })`.
  - Test: 100%.
  - Effort: 2h

- [x] **Step 2**: `LoopNode` spec (for-each)
  - File(s): `src/registry/builtins/LoopForEachNode.spec.ts`, `tests/unit/registry/builtins/LoopForEachNode.test.ts`
  - Contents: kind `'loop-foreach'`; adds `break` port; `propertySchema = z.object({ iterable: z.string().min(1), item: z.string() })`.
  - Test: 100%.
  - Effort: 2h

- [x] **Step 3**: `LoopNode` React component
  - File(s): `src/features/nodes/LoopNode.tsx`, `tests/unit/features/nodes/LoopNode.test.tsx`
  - Contents: Rounded rectangle with "↻" badge; handles placed per spec; iteration counter slot (populated by Phase 6).
  - Test: 100% — handles rendered; icon visible; counter slot empty in authoring mode.
  - Effort: 3h

- [x] **Step 4**: `LoopBackEdge` component (dashed, curved, arrow back)
  - File(s): `src/features/edges/LoopBackEdge.tsx`, `src/features/edges/edgeAnimations.css` (base), `tests/unit/features/edges/LoopBackEdge.test.tsx`
  - Contents: `stroke-dasharray: 6 4`; curved path that routes around the loop body; arrow-head pointing back to `body-in`.
  - Test: 100% — visually distinct from `DefaultEdge`; default label "loop".
  - Effort: 3h

- [x] **Step 5**: Validator — exactly one loop-back edge per loop node; target = `body-in`
  - File(s): `src/domain/validation/graphRules.ts` (extend), `tests/unit/domain/validation/graphRules.loop.test.ts`
  - Contents: For each loop node: count back-edges == 1; target port == `body-in`.
  - Test: 100% — 0 fails; 2 fails; wrong target fails.
  - Effort: 3h

- [x] **Step 6**: Validator — no back-edges on non-loop nodes
  - File(s): `src/domain/validation/graphRules.ts` (extend), `tests/unit/domain/validation/graphRules.noBackEdge.test.ts`
  - Contents: Cycle detection via DFS; any cycle not involving a loop node fails with `UnexpectedCycleError`.
  - Test: 100% — direct cycle via non-loop nodes fails; loop-based cycle passes.
  - Effort: 2h

- [ ] **Step 7**: Inline loop property editor (condition / iterable)
  - File(s): `src/features/nodes/LoopNode.tsx` (extend), `tests/integration/loop.inline-edit.test.tsx`
  - Contents: Click condition preview → inline input; blur commits; sync with property grid if panel open.
  - Test: Integration — edit via node UI reflects in store and property grid.
  - Effort: 2h

- [ ] **Step 8**: Integration — while-loop; nested while inside for-each; validator passes
  - File(s): `tests/integration/loop.end-to-end.test.tsx`
  - Contents: Build nested loops; validator returns ok; serialize; deserialize; deep-equal.
  - Test: Green.
  - Effort: 3h

## Acceptance for Stage 2

- All 8 steps `[x]` with score ≥ 90.
- 100% unit coverage on new files.
- Loop fixture added to `tests/fixtures/`.
