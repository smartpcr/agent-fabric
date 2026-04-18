# Phase 6 — Stage 1: Execution Event Contract

> Execution event types, the `IExecutionEventSource` port, and SSE / WebSocket adapters.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: `ExecutionEvent` discriminated union
  - File(s): `src/domain/models/executionEvent.ts`, `tests/unit/domain/models/executionEvent.test.ts`
  - Contents: Event types — `node.started`, `node.succeeded`, `node.failed`, `node.skipped`, `edge.activated`, `edge.taken`, `run.started`, `run.completed`, `run.failed`, `run.cancelled`; each carries `runId`, `at`, optional payload; Zod schema for runtime validation.
  - Test: 100% — each variant; exhaustive match via `assertNever`; Zod accepts/rejects.
  - Effort: 3h

- [x] **Step 2**: `IExecutionEventSource` interface
  - File(s): `src/ports/IExecutionEventSource.ts`, `tests/unit/ports/IExecutionEventSource.contract.test.ts`
  - Contents: `subscribe(runId, handler): Unsubscribe`; `connectionState$`: observable-like; `close()` ends source; contract test suite reusable by all adapters.
  - Test: 100% — contract tests structured as a reusable function that any adapter can import and run.
  - Effort: 2h

- [ ] **Step 3**: `FakeExecutionEventSource` for tests
  - File(s): `src/adapters/FakeExecutionEventSource.ts`, `tests/unit/adapters/FakeExecutionEventSource.test.ts`
  - Contents: In-memory source; `emit(event)` delivers to subscribers; `setConnectionState(state)`; used by integration + E2E tests.
  - Test: 100% — emit / subscribe / multi-subscriber; passes the contract tests.
  - Effort: 2h

- [ ] **Step 4**: `SseExecutionEventSource`
  - File(s): `src/adapters/SseExecutionEventSource.ts`, `tests/unit/adapters/SseExecutionEventSource.test.ts`
  - Contents: `eventsource-parser` for incremental parsing; exponential backoff with jitter on reconnect; heartbeat timeout (30s) triggers reconnect; Zod-validate incoming events.
  - Test: 100% — MSW-mocked SSE stream; reconnect with backoff; invalid event dropped with warning; passes contract tests.
  - Effort: 4h

- [ ] **Step 5**: `WsExecutionEventSource`
  - File(s): `src/adapters/WsExecutionEventSource.ts`, `tests/unit/adapters/WsExecutionEventSource.test.ts`
  - Contents: `reconnecting-websocket`; same Zod validation; ping/pong heartbeat.
  - Test: 100% — mock `WebSocket`; reconnect; heartbeat timeout; passes contract tests.
  - Effort: 3h

## Acceptance for Stage 1

- All 5 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/adapters/*ExecutionEventSource*` and event models.
- All adapters share a single contract test suite.
