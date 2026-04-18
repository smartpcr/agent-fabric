# Phase 7 — Stage 1: Repository Adapter

> HTTP-backed `IWorkflowRepository` with ETag concurrency, plus an in-memory fake.
> Status: `[ ]` not started · **Effort**: 12h

## Steps

- [x] **Step 1**: `HttpWorkflowRepository`
  - File(s): `src/adapters/HttpWorkflowRepository.ts`, `tests/unit/adapters/HttpWorkflowRepository.test.ts`
  - Contents: `list()`, `get(id)`, `save(id, graph, etag?)`, `create(graph)`; returns `Result<T, E>`; parses 200 / 404 / 409 / network errors.
  - Test: 100% — MSW-mocked for each status code.
  - Effort: 4h

- [ ] **Step 2**: `InMemoryWorkflowRepository`
  - File(s): `src/adapters/InMemoryWorkflowRepository.ts`, `tests/unit/adapters/InMemoryWorkflowRepository.test.ts`
  - Contents: Map-backed; simulates ETags via version counter.
  - Test: 100%.
  - Effort: 2h

- [ ] **Step 3**: `useWorkflowRepo` hook
  - File(s): `src/hooks/useWorkflowRepo.ts` (extend from Phase 0), `tests/unit/hooks/useWorkflowRepo.test.tsx`
  - Contents: Wraps repository; exposes `save`, `load` returning `Result`s; throws if used outside provider.
  - Test: 100%.
  - Effort: 2h

- [ ] **Step 4**: `SaveLoadBar` UI
  - File(s): `src/features/persistence/SaveLoadBar.tsx`, `tests/unit/features/persistence/SaveLoadBar.test.tsx`
  - Contents: Name field, Save / Load / New buttons; dirty indicator; last-saved timestamp.
  - Test: 100% — click Save dispatches; displays dirty state.
  - Effort: 2h

- [ ] **Step 5**: Optimistic-concurrency via ETag
  - File(s): `src/adapters/HttpWorkflowRepository.ts` (extend), `src/features/persistence/useSave.ts`, `tests/integration/persistence.conflict.test.tsx`
  - Contents: `If-Match` header; on 409, show "workflow changed elsewhere" toast with Reload / Force-save options.
  - Test: Integration — simulated conflict flow.
  - Effort: 2h

## Acceptance for Stage 1

- All 5 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/adapters/*Repository*`.
