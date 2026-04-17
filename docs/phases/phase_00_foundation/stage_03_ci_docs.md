# Phase 0 — Stage 3: CI & Docs
> Wire GitHub Actions for lint / typecheck / unit / coverage / Playwright; add bundle-size budget; write README and CONTRIBUTING; Phase 0 acceptance run.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [ ] **Step 1**: GitHub Actions — lint, typecheck, unit + coverage
  - File(s): `.github/workflows/ci.yml`
  - Contents: Matrix job on `ubuntu-latest`; steps: `setup-node@v4`, cache `~/.npm`, `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`; upload coverage report artifact; fail on any non-zero exit.
  - Test: Trigger a PR; CI green on a clean main.
  - Effort: 3h

- [ ] **Step 2**: GitHub Actions — Playwright matrix
  - File(s): `.github/workflows/e2e.yml`
  - Contents: On PR: Chromium only (fast). On `schedule: cron '0 6 * * *'`: full matrix (chromium + firefox + webkit). Cache Playwright browsers (`ms-playwright` dir). Upload `test-results/` trace on failure.
  - Test: Smoke passes locally and in CI on Chromium.
  - Effort: 3h

- [ ] **Step 3**: README with dev-loop instructions
  - File(s): `README.md`
  - Contents: Project overview, setup commands, architecture diagram (ASCII, same as plan), links to `docs/workflow-ui-plan.md` and phase docs, how to run tests, contribution link.
  - Test: N/A (manual review).
  - Effort: 2h

- [ ] **Step 4**: CONTRIBUTING + PR template
  - File(s): `CONTRIBUTING.md`, `.github/pull_request_template.md`
  - Contents: Commit conventions, branch naming, checklist (tests, coverage, accessibility, screenshots, linked phase/stage/step).
  - Test: N/A (manual review).
  - Effort: 2h

- [ ] **Step 5**: Bundle-size budget script
  - File(s): `scripts/check-bundle-size.mjs`, `.github/workflows/ci.yml` (extend)
  - Contents: Parse `dist/stats.json` (from `rollup-plugin-visualizer` or `vite build --json`); fail if main chunk gzip > 400KB or any chunk > 1MB.
  - Test: Unit — `tests/unit/scripts/check-bundle-size.test.ts` uses a fixture stats.json with both pass and fail cases.
  - Effort: 2h

- [ ] **Step 6**: Phase 0 acceptance run
  - File(s): —
  - Contents: Manual acceptance: run all commands in the "Exit Criteria" of `phase_00_foundation.md`; tick each; score the phase.
  - Test: All previous steps' tests still pass; coverage 100%; bundle under budget.
  - Effort: 2h

## Acceptance for Stage 3
- CI pipeline green on main.
- README and CONTRIBUTING reviewed.
- Bundle-size budget enforced.
- Phase 0 scored ≥ 90 overall.
