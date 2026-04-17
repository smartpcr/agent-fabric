# Phase 1 — Core Graph Model & Node Registry
> Part of [Workflow UI Implementation Plan](../workflow-ui-plan.md)

**Goal**: Deliver the pure-domain layer — models, validators, serialization, node registry with built-in `Start` / `End` / `Task` specs — 100% unit-tested, React-free. Wire the first store slices consuming this layer.

**Status**: `[ ]` not started · **Effort**: 70h · **Completed**: 0h · **Progress**: 0%

## Exit Criteria

1. A workflow graph can be constructed, validated, serialized to JSON, and deserialized back with round-trip equality.
2. `NodeRegistry` resolves three built-in specs; duplicate `kind` registration throws.
3. Zero production React code touches `src/domain/**`.
4. `graphSlice` supports add/remove/connect/update with undo-compatible actions.

## Stages

| # | Stage | Document | Steps | Effort (h) | Status |
|---|-------|----------|------:|-----------:|--------|
| 1 | Domain Models | [stage_01_domain_models.md](phase_01_core_graph_registry/stage_01_domain_models.md) | 6 | 14 | `[ ]` |
| 2 | Validation | [stage_02_validation.md](phase_01_core_graph_registry/stage_02_validation.md) | 6 | 16 | `[ ]` |
| 3 | Serialization & Registry | [stage_03_serialization_registry.md](phase_01_core_graph_registry/stage_03_serialization_registry.md) | 10 | 20 | `[ ]` |
| 4 | Store Wiring | [stage_04_store_wiring.md](phase_01_core_graph_registry/stage_04_store_wiring.md) | 9 | 20 | `[ ]` |
| **Total** | | | **30** | **70** | `[ ]` 0% |

## Architectural Notes

- **Pure domain** — `src/domain/**` imports nothing from React, xyflow, or zustand. This guarantees the domain is portable (could be reused server-side or in a worker).
- **Discriminated unions** for `NodeExecutionState`, `EdgeExecutionState`, `ExecutionEvent` — enables exhaustive pattern matching with `assertNever`.
- **Zod schemas own data validation** — node `propertySchema` is reused both by the property grid (Phase 5) and by `validateNodeData`.
- **Serialization is versioned** — every persisted file carries `schemaVersion: number`. Migration registry (Phase 7) composes stepwise migrations.
- **Commands on the store slice** — `addNode`, `connectPorts`, `updateNodeData` are named functions called from components and from tests.

## Risk Log

- **Zod schema complexity** for deeply nested node data → keep per-node schemas flat in Phase 1; introduce nested object/array fields alongside the Property Grid in Phase 5.
- **Fast-check property tests** can be slow → cap arbitrary sizes (`maxNodes: 30`) and runs (`numRuns: 100`); time-box to < 2s in CI.

## Definition of Done

- All 30 steps `[x]` with score ≥ 90.
- 100% unit-test coverage on `src/domain/**`, `src/registry/**`, `src/store/slices/**`.
- Integration test: author a 3-node graph through store actions, serialize, deserialize, deep-equal the original.
