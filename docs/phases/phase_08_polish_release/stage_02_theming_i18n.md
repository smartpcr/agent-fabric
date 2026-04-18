# Phase 8 — Stage 2: Theming & i18n

> Light/dark theme, i18n framework, string extraction, locale switcher.
> Status: `[ ]` not started · **Effort**: 12h

## Steps

- [x] **Step 1**: Light + dark themes
  - File(s): `src/styles/tokens.css` (extend), `src/providers/ThemeProvider.tsx`, `tests/unit/providers/ThemeProvider.test.tsx`
  - Contents: `data-theme="dark"` on `<html>`; persist to localStorage; respects `prefers-color-scheme` as default.
  - Test: 100% — toggle; persists; system-pref fallback.
  - Effort: 3h

- [ ] **Step 2**: `react-i18next` wiring + extraction script
  - File(s): `src/i18n/index.ts`, `src/i18n/locales/en.json`, `scripts/i18n-extract.mjs`, `tests/unit/i18n/i18n.test.ts`
  - Contents: i18next init; fallback `en`; extraction script scans `t('…')` calls and writes keys to `en.json`.
  - Test: 100% — `t('key')` returns correct string; missing key falls back.
  - Effort: 3h

- [ ] **Step 3**: Replace hard-coded strings with `t()`
  - File(s): `src/features/**`, `.eslintrc.cjs` (add `i18n-json` rule)
  - Contents: Custom ESLint rule rejects hard-coded strings in JSX text nodes; all existing strings migrated to `t()`.
  - Test: 100% — lint fails on a new hard-coded string; passes on migrated code.
  - Effort: 4h

- [ ] **Step 4**: Locale switcher (Radix Select) — English + French
  - File(s): `src/features/editor/LocaleSwitcher.tsx`, `src/i18n/locales/fr.json`, `tests/unit/features/editor/LocaleSwitcher.test.tsx`
  - Contents: Dropdown changes `i18n.language`; persists; French translations as smoke (can be machine-translated for now).
  - Test: 100% — switch changes rendered strings.
  - Effort: 2h

## Acceptance for Stage 2

- All 4 steps `[x]` with score ≥ 90.
- 100% unit coverage on i18n + theme.
- ESLint rule preventing new hard-coded strings.
