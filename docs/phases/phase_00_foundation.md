# Phase 0 — Foundation & Scaffolding
> Part of [Workflow UI Implementation Plan](../workflow-ui-plan.md)

**Goal**: Stand up a TypeScript + Vite + React + Tailwind project with `@xyflow/react` rendering an empty canvas, DI providers, a zustand store skeleton, and the full test toolchain running in CI.

**Status**: `[ ]` not started · **Effort**: 40h · **Completed**: 0h · **Progress**: 0%

## Exit Criteria

1. `npm run dev` serves an editor page with an empty `<ReactFlow>` canvas.
2. `npm run test` runs Vitest with `coverage.thresholds.100 = true` enforced on `src/**`.
3. `npm run e2e` launches Playwright and passes a smoke test.
4. `npm run lint` and `npm run typecheck` pass with zero errors.
5. CI pipeline green on main.

## Stages

| # | Stage | Document | Steps | Effort (h) | Status |
|---|-------|----------|------:|-----------:|--------|
| 1 | Repo & Build Tooling | [stage_01_repo_build_tooling.md](phase_00_foundation/stage_01_repo_build_tooling.md) | 6 | 12 | `[ ]` |
| 2 | App Shell & Providers | [stage_02_app_shell_providers.md](phase_00_foundation/stage_02_app_shell_providers.md) | 5 | 14 | `[ ]` |
| 3 | CI & Docs | [stage_03_ci_docs.md](phase_00_foundation/stage_03_ci_docs.md) | 6 | 14 | `[ ]` |
| **Total** | | | **17** | **40** | `[ ]` 0% |

## Architectural Notes

- **Strict TypeScript from day 1** — `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **Path aliases** — `@/*` → `src/*`; configured in both `tsconfig.json` and `vite.config.ts`.
- **Coverage gate** — 100% on `src/**/*.{ts,tsx}` excluding `*.d.ts`, `index.ts` re-exports, and generated code.
- **DI via React Context at the shell** — `RepositoryProvider`, `ExecutionProvider` expose hooks (`useWorkflowRepo`, `useExecutionEventSource`). Throwing when consumed without a provider surfaces wiring bugs loudly in development.
- **Zustand store is created once** via `createStore` factory (slices-based); component tests instantiate fresh stores via a `renderWithStore` helper.

## Risk Log

- **Node/npm version drift** → pin via `engines` field and `.nvmrc`.
- **Playwright install weight** → cache browsers in CI; only Chromium on per-PR runs; full matrix nightly.

## Definition of Done (phase-level)

- All 17 steps `[x]` with score ≥ 90.
- Coverage report shows 100% on all `src/` files touched.
- PR template + CONTRIBUTING live.
- `README.md` documents `dev / test / e2e / lint / typecheck` loop.
