# Phase 7 — Persistence, Versioning & Undo/Redo
> Part of [Workflow UI Implementation Plan](../workflow-ui-plan.md)

**Goal**: Save/load to a backend via `IWorkflowRepository`; import/export JSON files; schema versioning with migrations; undo/redo ≥50 steps; auto-save with conflict detection.

**Status**: `[ ]` not started · **Effort**: 50h · **Completed**: 0h · **Progress**: 0%

## Exit Criteria

1. User can save a workflow and reload it identically.
2. Exporting, manually editing a migrated-aware field, and re-importing yields the same graph after migration.
3. Undo/redo chain ≥ 50 steps stable; dragging a node produces a single undo step.
4. Auto-save fires only when the graph is dirty.
5. 409 (conflict) surfaces a user-visible message; user can force-save or reload.

## Stages

| # | Stage | Document | Steps | Effort (h) | Status |
|---|-------|----------|------:|-----------:|--------|
| 1 | Repository Adapter | [stage_01_repository_adapter.md](phase_07_persistence_undo/stage_01_repository_adapter.md) | 5 | 12 | `[ ]` |
| 2 | Import / Export | [stage_02_import_export.md](phase_07_persistence_undo/stage_02_import_export.md) | 4 | 10 | `[ ]` |
| 3 | Undo / Redo | [stage_03_undo_redo.md](phase_07_persistence_undo/stage_03_undo_redo.md) | 6 | 14 | `[ ]` |
| 4 | Versioning & Migration | [stage_04_versioning_migration.md](phase_07_persistence_undo/stage_04_versioning_migration.md) | 5 | 10 | `[ ]` |
| 5 | Phase 7 E2E | [stage_05_e2e.md](phase_07_persistence_undo/stage_05_e2e.md) | 2 | 4 | `[ ]` |
| **Total** | | | **22** | **50** | `[ ]` 0% |

## Architectural Notes

- **ETag-based concurrency** — `HttpWorkflowRepository` sends `If-Match`; a 409 surfaces "workflow changed elsewhere" toast with reload/force-save options.
- **Result type for adapters** — no exceptions; callers pattern-match on `{ ok: true, value } | { ok: false, error }`.
- **History grouping** — consecutive `updateNodePosition` events during a drag are grouped into a single history entry via a pending-timer debouncer.
- **Migration registry** — `{ fromVersion: number → (json) => json }` map. `migrate(json)` composes entries until `json.schemaVersion === CURRENT_VERSION`.
- **Auto-save** — 10s debounce after any `[x]` mutation in the temporal middleware; skipped if validation fails.

## Risk Log

- **Undo polluting execution state** → `partialize` on zundo excludes `executionSlice` and `selectionSlice`.
- **Huge graphs auto-saving too often** → debounce 10s; cap payload size to 5MB with warning.
- **Migration bugs** → every version bump ships with fixtures for both old and new format, plus a round-trip test.

## Definition of Done

- All 22 steps `[x]` with score ≥ 90.
- 50-step undo/redo integration test passes.
- Round-trip (save → reload → equality) E2E green.
- Auto-save does not fire when no changes; verified by idle observation.
