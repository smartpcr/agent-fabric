# Phase 6 — Stage 5: Run Inspector & Controls

> Slide-in inspector showing per-node event timeline, plus run controls and connection status.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: `RunInspector` panel (Radix Dialog, slide-in)
  - File(s): `src/features/execution/RunInspector.tsx`, `tests/unit/features/execution/RunInspector.test.tsx`
  - Contents: Right-side sheet; focus-trap; Escape closes; opens on error badge click or from run controls.
  - Test: 100% — open/close; focus trap; Escape dismisses.
  - Effort: 3h

- [x] **Step 2**: Event timeline for selected node
  - File(s): `src/features/execution/EventTimeline.tsx`, `tests/unit/features/execution/EventTimeline.test.tsx`
  - Contents: Chronologically ordered events for `(runId, nodeId)`; payload pretty-printed via `<pre>`; copyable.
  - Test: 100% — events in order; payload rendered; copy works.
  - Effort: 3h

- [x] **Step 3**: `RunControls` — Start / Pause / Cancel → `IExecutionCommandSink`
  - File(s): `src/features/execution/runControls.tsx`, `src/hooks/useExecutionCommand.ts`, `tests/unit/features/execution/runControls.test.tsx`
  - Contents: Buttons dispatch typed commands; disabled states based on run status; keyboard shortcuts (Ctrl+R run, Ctrl+. cancel).
  - Test: 100% — each dispatch; disabled states correct.
  - Effort: 2h

- [ ] **Step 4**: `useExecutionSubscription` lifecycle hook
  - File(s): `src/features/execution/useExecutionSubscription.ts`, `tests/unit/features/execution/useExecutionSubscription.test.tsx`
  - Contents: Subscribes on mount; unsubscribes on unmount; ignores post-unmount events via a ref flag.
  - Test: 100% — subscribe on mount; cleanup on unmount; late event dropped.
  - Effort: 2h

- [ ] **Step 5**: Connection status indicator
  - File(s): `src/features/execution/ConnectionStatus.tsx`, `tests/unit/features/execution/ConnectionStatus.test.tsx`
  - Contents: Reads `connectionState$` from event source; renders `connected / reconnecting / disconnected` badge.
  - Test: 100% — state transitions reflected.
  - Effort: 2h

- [ ] **Step 6**: Phase 6 acceptance + score review
  - File(s): —
  - Contents: Walk exit criteria; update phase status row.
  - Effort: 2h

## Acceptance for Stage 5

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/execution/**`.
- axe-core clean on inspector panel.
