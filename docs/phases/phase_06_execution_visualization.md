# Phase 6 — Execution Visualization (Badges & Animation)

> Part of [Workflow UI Implementation Plan](../workflow-ui-plan.md)

**Goal**: Live execution stream (SSE / WS behind `IExecutionEventSource`) drives per-node badges and per-edge animations. Inspector panel shows event payloads. Authoring graph state is never mutated by runtime events.

**Status**: `[ ]` in progress · **Effort**: 80h · **Completed**: 70h · **Progress**: 87%

## Exit Criteria

1. `FakeExecutionEventSource.emit({ type: 'node.started', nodeId })` causes the node to render a running spinner within one animation frame.
2. Edges animate (flowing dashes) while data is moving; flash on success/error.
3. `RunInspector` shows a chronological event timeline for a selected node.
4. Run controls (start / pause / cancel) dispatch to `IExecutionCommandSink`.
5. Connection state (connected / reconnecting / disconnected) is visible.
6. E2E: scripted 5-node run drives correct visual state through success + error paths.

## Stages

| #         | Stage                    | Document                                                                                    |  Steps | Effort (h) | Status    |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------- | -----: | ---------: | --------- |
| 1         | Execution Event Contract | [stage_01_event_contract.md](phase_06_execution_visualization/stage_01_event_contract.md)   |      5 |         14 | `[x]`     |
| 2         | Execution State Store    | [stage_02_execution_store.md](phase_06_execution_visualization/stage_02_execution_store.md) |      6 |         14 | `[x]`     |
| 3         | Node Badges              | [stage_03_node_badges.md](phase_06_execution_visualization/stage_03_node_badges.md)         |      6 |         14 | `[x]`     |
| 4         | Edge Animation           | [stage_04_edge_animation.md](phase_06_execution_visualization/stage_04_edge_animation.md)   |      6 |         14 | `[x]`     |
| 5         | Run Inspector & Controls | [stage_05_run_inspector.md](phase_06_execution_visualization/stage_05_run_inspector.md)     |      6 |         14 | `[x]`     |
| 6         | Phase 6 E2E              | [stage_06_e2e.md](phase_06_execution_visualization/stage_06_e2e.md)                         |      4 |         10 | `[ ]`     |
| **Total** |                          |                                                                                             | **33** |     **80** | `[ ]` 87% |

## Architectural Notes

- **Execution state is out-of-band** — `executionSlice` is keyed by `(runId, nodeId)` and `(runId, edgeId)`. The authoring graph (nodes/edges arrays) is never mutated. This means the same graph can be re-run without dirtying the document.
- **RAF coalescing** — execution events arrive in bursts. A `rafBatcher` queues them and commits once per animation frame to avoid layout thrash at 20+ ev/sec.
- **CSS animations, not JS** — flowing dashes and success/error flashes use CSS transitions on SVG `stroke-dashoffset` and filters. Respects `prefers-reduced-motion`.
- **Event source lifecycle** — `useExecutionSubscription` subscribes on mount, unsubscribes on unmount, and ignores post-unmount events (prevents writing to an unmounted store from an in-flight network response).
- **Reconnect with backoff** — `SseExecutionEventSource` and `WsExecutionEventSource` both implement exponential backoff with jitter; a heartbeat timeout surfaces "disconnected" state.

## Risk Log

- **Event ordering** — out-of-order `node.succeeded` before `node.started` → guard via transition table; drop illegal transitions with a warning.
- **High-rate runs** (e.g. 100 ev/sec) → benchmark in Stage 4; cap visible updates to one per frame.
- **Accessibility for animations** → `role="status"` on running badges; reduced-motion mode keeps state indicators but drops the dash animation.

## Definition of Done

- All 33 steps `[x]` with score ≥ 90.
- Performance benchmark: 200-node graph, 20 ev/sec, p95 < 16ms frame time.
- E2E: scripted success + error + loop iteration runs all pass.
- Reduced-motion mode visually verified.
