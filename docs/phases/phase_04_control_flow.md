# Phase 4 — Control Flow Nodes (Decision & Loop)
> Part of [Workflow UI Implementation Plan](../workflow-ui-plan.md)

**Goal**: Support conditional branching (decision / switch) and loops (while / for-each) with a layout engine (ELK) that routes back-edges cleanly. The graph validator enforces control-flow invariants.

**Status**: `[ ]` not started · **Effort**: 80h · **Completed**: 0h · **Progress**: 0%

## Exit Criteria

1. `DecisionNode` (if/else variant) supports 2 labeled output branches; switch variant supports N + `default`.
2. Each decision edge carries a condition expression persisted in `WorkflowEdge.condition`.
3. `LoopNode` supports body-in / body-out / done / break ports and exactly one back-edge.
4. ELK auto-layout handles a mixed graph (sequence + decision + loop) without overlap; back-edges route orthogonally.
5. Validator flags: missing `default` branch, multiple back-edges, invalid back-edge targets.

## Stages

| # | Stage | Document | Steps | Effort (h) | Status |
|---|-------|----------|------:|-----------:|--------|
| 1 | Decision Node | [stage_01_decision_node.md](phase_04_control_flow/stage_01_decision_node.md) | 7 | 18 | `[ ]` |
| 2 | Loop Node | [stage_02_loop_node.md](phase_04_control_flow/stage_02_loop_node.md) | 8 | 20 | `[ ]` |
| 3 | Layout Engine | [stage_03_layout_engine.md](phase_04_control_flow/stage_03_layout_engine.md) | 8 | 22 | `[ ]` |
| **Total** | | | **23** | **80** | `[ ]` 0% |

## Architectural Notes

- **Control flow is a data concern** — `LoopNode` carries `iterationExpression`, `DecisionNode` carries `condition`. The UI shows previews; the backend evaluates at runtime.
- **Back-edges** — modeled as `WorkflowEdge.kind = 'loop-back'`. The validator enforces: source has `canHaveBackEdge`, target is the source's `body-in` port, exactly one per loop node.
- **ELK (Eclipse Layout Kernel)** — WASM-loaded once, cached. Layered strategy with orthogonal routing + greedy cycle breaking produces readable control-flow diagrams.
- **Loop visual affordance** — body nodes are grouped by a soft background rectangle (xyflow parent node) so users can see what's inside a loop.

## Risk Log

- **ELK WASM bundle size** (~500KB) → lazy-load on first "auto-layout" click; defer initial editor load.
- **Back-edge drawing during drag** → when user drags from a loop's `body-out` back to its own `body-in`, draw with the same dashed style as the final edge, not the default preview.

## Definition of Done

- All 23 steps `[x]` with score ≥ 90.
- Decision + loop fixtures added to `tests/fixtures/` for reuse.
- Integration: 20-node mixed graph auto-layouts without node overlap.
- No lint / type / coverage regressions.
