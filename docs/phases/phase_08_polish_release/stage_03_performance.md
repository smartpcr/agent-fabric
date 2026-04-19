# Phase 8 — Stage 3: Performance

> Code-split heavy deps, benchmark suite, selector audit, Lighthouse CI.
> Status: `[x]` complete · **Effort**: 12h

## Steps

- [x] **Step 1**: Code-split Monaco / CodeField
  - File(s): `src/features/property-grid/fields/CodeField.tsx` (extend), `vite.config.ts` (manual chunks), `tests/unit/features/property-grid/fields/CodeField.lazy.test.tsx`
  - Contents: `React.lazy` + `Suspense`; manual chunk name `code-field`; skeleton during load.
  - Test: 100% — bundle stats show Monaco in its own chunk; main chunk under budget.
  - Effort: 3h

- [x] **Step 2**: Benchmark — 500-node pan/zoom ≥ 55 fps
  - File(s): `tests/performance/canvas.bench.ts`
  - Contents: Generate 500-node graph; simulate pan over 1 second; measure frames.
  - Test: Benchmark threshold.
  - Effort: 4h

- [x] **Step 3**: Selector memoization audit
  - File(s): `src/store/selectors/**` (various), profiler report notes.
  - Contents: React Devtools Profiler recording + React.memo audit on nodes/edges; fix any selector returning new references unnecessarily.
  - Effort: 3h

- [x] **Step 4**: Lighthouse CI config + thresholds
  - File(s): `.lighthouserc.json`, `.github/workflows/lighthouse.yml`
  - Contents: Performance ≥ 90; accessibility ≥ 95; best-practices ≥ 90; SEO ignored (internal app).
  - Test: CI run passes thresholds on main.
  - Effort: 2h

## Acceptance for Stage 3

- All 4 steps `[x]` with score ≥ 90.
- All performance budgets met.
