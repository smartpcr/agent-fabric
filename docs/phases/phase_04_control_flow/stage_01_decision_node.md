# Phase 4 — Stage 1: Decision Node

> Implement if/else and switch-style decision nodes with labeled branches, conditional edges, and validator rules.
> Status: `[ ]` not started · **Effort**: 18h

## Steps

- [x] **Step 1**: `DecisionNode` spec (if/else): 1 in, 2 out (`true`, `false`)
  - File(s): `src/registry/builtins/DecisionNode.spec.ts`, `tests/unit/registry/builtins/DecisionNode.test.ts`
  - Contents: kind `'decision'`, variant `'if-else'`; `propertySchema = z.object({ condition: z.string().min(1) })`.
  - Test: 100% — spec shape; registers cleanly.
  - Effort: 2h

- [x] **Step 2**: `DecisionNode` React component — diamond shape + condition preview
  - File(s): `src/features/nodes/DecisionNode.tsx`, `tests/unit/features/nodes/DecisionNode.test.tsx`
  - Contents: Diamond SVG background; 2 labeled output handles (`true` on right, `false` on bottom); input handle on left; condition preview text truncated.
  - Test: 100% — labels rendered; condition preview binds to data.
  - Effort: 3h

- [x] **Step 3**: Switch-style `DecisionNode` variant
  - File(s): `src/registry/builtins/DecisionSwitchNode.spec.ts`, `src/features/nodes/DecisionNode.tsx` (extend), `tests/unit/features/nodes/DecisionNode.switch.test.tsx`
  - Contents: N configurable branches via `propertySchema.branches: z.array(z.object({ label, condition }))`; always includes implicit `default` port.
  - Test: 100% — 2, 3, 5 branches; `default` always present; handles evenly spaced.
  - Effort: 3h

- [x] **Step 4**: `ConditionalEdge` component with label chip
  - File(s): `src/features/edges/ConditionalEdge.tsx` (upgrade stub), `tests/unit/features/edges/ConditionalEdge.test.tsx`
  - Contents: Label rendered in a pill chip styled by `data.condition` state; hover tooltip shows full condition.
  - Test: 100% — chip visible; hover tooltip; empty condition shows "—".
  - Effort: 2h

- [x] **Step 5**: Property schema for decision (condition + branches)
  - File(s): `src/registry/builtins/DecisionNode.spec.ts` (extend), `tests/unit/registry/builtins/DecisionNode.schema.test.ts`
  - Contents: Zod schemas for both variants; `defaultData` conforms.
  - Test: 100% — schema valid/invalid cases.
  - Effort: 2h

- [x] **Step 6**: Validator — each outgoing edge matches a branch or `default`
  - File(s): `src/domain/validation/graphRules.ts` (extend), `tests/unit/domain/validation/graphRules.decision.test.ts`
  - Contents: For decision nodes, every outgoing edge's `sourcePort` must be a declared branch id or `default`; duplicate branches fail; missing `default` produces a warning.
  - Test: 100% — orphan branch fails; duplicate fails; missing default warns.
  - Effort: 3h

- [ ] **Step 7**: Integration — author if/else + switch; validate; save; reload
  - File(s): `tests/integration/decision.end-to-end.test.tsx`
  - Contents: Build graph with both variants; validate; serialize; deserialize; deep-equal.
  - Test: Green.
  - Effort: 3h

## Acceptance for Stage 1

- All 7 steps `[x]` with score ≥ 90.
- 100% unit coverage on new files.
- Decision fixture added to `tests/fixtures/`.
