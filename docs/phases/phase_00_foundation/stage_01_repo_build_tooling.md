# Phase 0 — Stage 1: Repo & Build Tooling
> Scaffold a strict TypeScript + Vite + React project with Tailwind, Vitest, Playwright, ESLint/Prettier, and husky pre-commit gates.
> Status: `[ ]` not started · **Effort**: 12h

## Steps

- [x] **Step 1**: Initialize Vite + React + TypeScript project
  - File(s): `package.json`, `tsconfig.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `index.html`, `.gitignore`, `.nvmrc`
  - Contents: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`; path alias `@/*` → `./src/*` in both tsconfig and vite config; `engines.node` pinned.
  - Test: Unit — `tests/unit/app.smoke.test.tsx` imports `App` and asserts render without crash; `npm run dev` starts without errors (manual).
  - Effort: 2h

- [x] **Step 2**: Configure Tailwind + design tokens + CSS reset
  - File(s): `tailwind.config.js`, `postcss.config.js`, `src/styles/tailwind.css`, `src/styles/tokens.css`
  - Contents: Design tokens for color/spacing/radius/shadow as CSS custom properties; dark-mode via `[data-theme="dark"]`; `tailwind.config.js` reads from tokens via `theme.extend`.
  - Test: Unit — `tokens.css` parsed by PostCSS contains the expected variables (regex assertion: `--color-bg`, `--color-fg`, `--radius-md`, etc.).
  - Effort: 2h

- [x] **Step 3**: ESLint + Prettier + typecheck scripts
  - File(s): `.eslintrc.cjs`, `.prettierrc`, `.editorconfig`, `package.json` (scripts block)
  - Contents: `eslint-config-typescript-strict`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`; prettier with 2-space tabs, 100-col line. Scripts: `lint`, `lint:fix`, `format`, `typecheck`.
  - Test: `npm run lint` + `npm run typecheck` exit 0 on an empty `App.tsx`; CI job (from Stage 3) re-runs both.
  - Effort: 2h

- [x] **Step 4**: Vitest + coverage + jsdom
  - File(s): `vitest.config.ts`, `tests/setup.ts`, `package.json` (scripts: `test`, `test:coverage`, `test:ui`)
  - Contents: `@vitest/coverage-v8`; `coverage.include = ['src/**/*.{ts,tsx}']`; `coverage.exclude = ['src/**/*.d.ts', 'src/**/index.ts', 'src/main.tsx']`; `coverage.thresholds = { 100: true }` on lines/branches/functions/statements.
  - Test: `npm run test` runs and reports green with one trivial test; `npm run test:coverage` prints an HTML report into `coverage/` and fails if thresholds aren't met.
  - Effort: 2h

- [x] **Step 5**: Playwright install + smoke spec
  - File(s): `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `package.json` (script: `e2e`, `e2e:install`)
  - Contents: `webServer` config boots `vite preview` on port 4173; Chromium project by default; reporters `html` + `line`; traces on retry.
  - Test: `tests/e2e/smoke.spec.ts` asserts page title contains "Workflow Editor"; `npm run e2e` exits 0 locally.
  - Effort: 2h

- [ ] **Step 6**: Husky + lint-staged commit gate
  - File(s): `.husky/pre-commit`, `package.json` (lint-staged config), `package.json` (`prepare` script)
  - Contents: On staged `*.{ts,tsx}`: run `eslint --fix`, `prettier --write`, `vitest related --run`. On staged `*.md`: run `prettier --write`.
  - Test: Unit — `tests/unit/lint-staged.config.test.ts` imports the lint-staged config object and asserts the expected file globs and commands are wired; manual check: intentionally broken staged file is rejected.
  - Effort: 2h

## Acceptance for Stage 1
- `npm run dev / test / e2e / lint / typecheck` all exit 0.
- 100% coverage maintained on any file touched under `src/`.
- Husky blocks a lint-failing commit.
