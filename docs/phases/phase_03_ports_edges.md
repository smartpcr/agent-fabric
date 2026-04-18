# Phase 3 — Ports, Edges & Connection Validation

> Part of [Workflow UI Implementation Plan](../workflow-ui-plan.md)

**Goal**: Ports are first-class. A node can expose N inputs and M outputs. Connections drag visually, validate against port specs, reject incompatible pairs with a user-visible reason, and edges render with labels, types, and default / loop-back styling.

**Status**: `[~]` stages 1–4 complete; stage 5 (E2E) pending · **Effort**: 60h · **Completed**: 54h · **Progress**: 90%

## Exit Criteria

1. A `TaskNode` variant exposes 2 inputs + 3 outputs; only compatible pairs can be connected.
2. Invalid connection attempts show a rejection reason in a toast; no store mutation.
3. Edge labels render and are editable inline.
4. Keyboard path: focus output → Enter → arrow-key target → Enter to commit.
5. Required input ports show a visible indicator when unconnected.

## Stages

| #         | Stage                              | Document                                                                                        |  Steps | Effort (h) | Status    |
| --------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- | -----: | ---------: | --------- |
| 1         | Port Rendering                     | [stage_01_port_rendering.md](phase_03_ports_edges/stage_01_port_rendering.md)                   |      6 |         14 | `[x]`     |
| 2         | Connection Interaction             | [stage_02_connection_interaction.md](phase_03_ports_edges/stage_02_connection_interaction.md)   |      6 |         14 | `[x]`     |
| 3         | Edge Rendering                     | [stage_03_edge_rendering.md](phase_03_ports_edges/stage_03_edge_rendering.md)                   |      7 |         16 | `[x]`     |
| 4         | Cardinality & DataType Enforcement | [stage_04_cardinality_enforcement.md](phase_03_ports_edges/stage_04_cardinality_enforcement.md) |      5 |         10 | `[x]`     |
| 5         | Phase 3 E2E                        | [stage_05_e2e.md](phase_03_ports_edges/stage_05_e2e.md)                                         |      3 |          6 | `[ ]`     |
| **Total** |                                    |                                                                                                 | **27** |     **60** | `[~]` 90% |

> Note: Phase total shows **23 steps** in the main plan table, which sums the deliverable steps; the 27 here include E2E scenarios (counted separately as integration/e2e items). Either number is tracked through the stage checklists.

## Architectural Notes

- **Port spec is authoritative** — xyflow's `<Handle>` is a view concern; `PortSpec` is the domain truth. A `<InputHandle portSpec={...}/>` wrapper binds the two.
- **`isValidConnection`** — xyflow callback consulted live during drag, calling into our domain validator so users see red/green before dropping.
- **Edge type registry** — `edgeTypes` map mirrors `nodeTypes`; `ConditionalEdge` (used by Phase 4) is registered with a placeholder implementation here so lookups don't need a second pass later.
- **DataType assignability** — runs through `dataTypes.ts` table; `any` accepts all, others are strict by default (avoid accidental lossy coercions).

## Risk Log

- **Handle positioning for many ports** → `handleLayout.ts` distributes evenly along node edges; tested up to 10 ports.
- **Tooltip z-index on edges** → Radix tooltip portal mounts on `<body>` to escape xyflow's transform.

## Definition of Done

- All steps `[x]` with score ≥ 90.
- Multi-port TaskNode fixture lives in `tests/fixtures/` for reuse in Phases 4–6.
- Zero axe-core violations on editor page with multi-port graph.

## Acceptance Scorecard

> Verified on completion of Stage 4 Step 5. All scores from evaluator iterations. Stage 5 (E2E) is not yet started and is excluded from scoring.

### Exit Criteria Verification

| #   | Criterion                                                                      | Evidence                                                                                                                                              | Verdict |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | TaskNode variant exposes 2 inputs + 3 outputs; only compatible pairs connected | `MultiPortTaskNodeSpec` in `tests/fixtures/multiPortSpec.ts`; `connectionRules.ts` rejects incompatible pairs ✓                                       | ✅ Pass |
| 2   | Invalid connection → rejection toast; no store mutation                        | `Canvas.tsx` `tryConnect` error path + `tests/integration/connection.rejection.test.tsx` ✓                                                            | ✅ Pass |
| 3   | Edge labels render and are editable inline                                     | `DefaultEdge.tsx` label rendering + `InlineLabelEditor.tsx` double-click edit + `tests/unit/features/edges/InlineLabelEditor.test.tsx` ✓              | ✅ Pass |
| 4   | Keyboard path: focus output → Enter → arrow → Enter to commit                  | `tests/integration/connection.keyboard.test.tsx` (8 tests) ✓                                                                                          | ✅ Pass |
| 5   | Required input ports show visible indicator when unconnected                   | `InputHandle.tsx` emits `data-missing="true"` + CSS red outline in `tailwind.css` + `tests/unit/features/nodes/ports/InputHandle.required.test.tsx` ✓ | ✅ Pass |

### Per-Stage Scores

| Stage                                  |  Steps | Scores (per step)          | Stage Avg |
| -------------------------------------- | -----: | -------------------------- | --------- |
| 1 — Port Rendering                     |      6 | 94, 93, 92, 93, 94, 93     | **93.2**  |
| 2 — Connection Interaction             |      6 | 93, 94, 92, 93, 93, 94     | **93.2**  |
| 3 — Edge Rendering                     |      7 | 94, 93, 93, 94, 93, 92, 94 | **93.3**  |
| 4 — Cardinality & DataType Enforcement |      5 | 93, 94, 93, 96, 94         | **94.0**  |
| **Overall (stages 1–4)**               | **24** |                            | **93.4**  |

### Test Evidence Summary

- **Unit/Integration**: 972 tests, 97 files — all passing (`npx vitest run`)
- **Multi-port fixture**: `tests/fixtures/multiPortSpec.ts` present for reuse in Phases 4–6
- **Build**: `npx vite build` succeeds
