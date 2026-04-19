# Phase 8 — Polish, Accessibility & Release

> Part of [Workflow UI Implementation Plan](../workflow-ui-plan.md)

**Goal**: Production-ready: a11y certified, theming, i18n scaffolding, performance budgets met, docs, release pipeline.

**Status**: `[x]` complete · **Effort**: 50h · **Completed**: 50h · **Progress**: 100%

## Exit Criteria

1. axe-core reports zero violations on all main views.
2. Keyboard-only user can author and run a workflow without touching a mouse.
3. Bundle budget met (main chunk ≤ 400 KB gzipped; CodeField lazy-loaded).
4. Lighthouse: performance ≥ 90, accessibility ≥ 95.
5. Semver release pipeline publishes on tag push.

## Stages

| #         | Stage                   | Document                                                                       |  Steps | Effort (h) | Status     |
| --------- | ----------------------- | ------------------------------------------------------------------------------ | -----: | ---------: | ---------- |
| 1         | Accessibility Hardening | [stage_01_accessibility.md](phase_08_polish_release/stage_01_accessibility.md) |      5 |         14 | `[x]`      |
| 2         | Theming & i18n          | [stage_02_theming_i18n.md](phase_08_polish_release/stage_02_theming_i18n.md)   |      4 |         12 | `[x]`      |
| 3         | Performance             | [stage_03_performance.md](phase_08_polish_release/stage_03_performance.md)     |      4 |         12 | `[x]`      |
| 4         | Docs & Release          | [stage_04_docs_release.md](phase_08_polish_release/stage_04_docs_release.md)   |      4 |         12 | `[x]`      |
| **Total** |                         |                                                                                | **17** |     **50** | `[x]` 100% |

## Architectural Notes

- **No new features in Phase 8** — only polish, hardening, docs. Scope discipline here prevents endless drift.
- **Theme tokens** — all color / spacing / radius / shadow live in `src/styles/tokens.css` with CSS custom properties; dark mode via `[data-theme="dark"]`.
- **i18n ESLint rule** — `eslint-plugin-i18n-json` + a custom rule that rejects hard-coded strings inside `<jsx>` text nodes.
- **Lighthouse CI** — `.lighthouserc.json` with thresholds wired into CI; regressions block merge.
- **Release pipeline** — on tag `v*`, runs full test matrix + Lighthouse + bundle size, then `npm publish` (library mode) or uploads a Docker image (app mode).

## Risk Log

- **Hidden a11y issues** only found by real screen-reader users → pair with manual NVDA + VoiceOver walkthrough documented in `docs/a11y-walkthrough.md`.
- **Bundle creep** → bundle size script runs in CI; a PR adding > 10KB must justify.

## Definition of Done

- All 17 steps `[x]` with score ≥ 90.
- Lighthouse CI passing thresholds on main.
- Release pipeline tested with a dry-run tag.
- User + developer docs live under `docs/user-guide/` and `docs/developer-guide/`.
