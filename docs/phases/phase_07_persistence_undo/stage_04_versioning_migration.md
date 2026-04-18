# Phase 7 — Stage 4: Versioning & Migration

> Schema version gating, migration registry, auto-save.
> Status: `[ ]` not started · **Effort**: 10h

## Steps

- [x] **Step 1**: `schemaVersion` gating on every persisted file
  - File(s): `src/domain/serialization/deserialize.ts` (extend), `tests/unit/domain/serialization/deserialize.versioning.test.ts`
  - Contents: Reject unknown version with `MigrationError`.
  - Test: 100% — unknown version rejected; known passes through.
  - Effort: 2h

- [x] **Step 2**: Migration registry + composition
  - File(s): `src/domain/serialization/migrate.ts` (extend), `tests/unit/domain/serialization/migrate.registry.test.ts`
  - Contents: `registerMigration(fromVersion, fn)`; `migrate(json)` composes steps until current; idempotent when already current.
  - Test: 100% — v1→v2→v3 composition; missing step throws; already-current is identity.
  - Effort: 3h

- [x] **Step 3**: Example migration fixture (v1 identity)
  - File(s): `tests/fixtures/migration/v1.json`, `tests/unit/domain/serialization/migrate.identity.test.ts`
  - Contents: Fixture matches current schema; identity migration passes.
  - Test: 100%.
  - Effort: 1h

- [ ] **Step 4**: Auto-save (debounced 10s, dirty flag)
  - File(s): `src/features/persistence/useAutoSave.ts`, `tests/unit/features/persistence/useAutoSave.test.ts`
  - Contents: Listens to store `[x]` mutations (via zundo subscription); 10s debounce; skipped when graph has validation errors; dispatches save via `useWorkflowRepo`.
  - Test: 100% — fake timers; no save when clean; save on dirty; skip on invalid.
  - Effort: 3h

- [ ] **Step 5**: Phase 7 acceptance + score review
  - File(s): —
  - Contents: Walk exit criteria; update phase status row.
  - Effort: 1h

## Acceptance for Stage 4

- All 5 steps `[x]` with score ≥ 90.
- Migration test fixture in place.
- Phase 7 scored ≥ 90 overall.
