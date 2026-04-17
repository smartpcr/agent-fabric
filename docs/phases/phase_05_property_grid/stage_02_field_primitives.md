# Phase 5 — Stage 2: Field Primitives
> Eight accessible field components: string, number, boolean, enum, array, object, code, secret.
> Status: `[ ]` not started · **Effort**: 20h

## Steps

- [ ] **Step 1**: `StringField` (single-line)
  - File(s): `src/features/property-grid/fields/StringField.tsx`, `tests/unit/features/property-grid/fields/StringField.test.tsx`
  - Contents: `<input type="text">`; `aria-describedby` for error; placeholder from schema description.
  - Test: 100% — value, onChange, error visibility.
  - Effort: 2h

- [ ] **Step 2**: `NumberField` with min/max/step from schema
  - File(s): `src/features/property-grid/fields/NumberField.tsx`, `tests/unit/features/property-grid/fields/NumberField.test.tsx`
  - Contents: `<input type="number">`; reads `min`, `max`, `step` from Zod schema checks; clamps non-numeric to previous valid.
  - Test: 100% — clamp; step increments via keyboard; invalid input rejected.
  - Effort: 2h

- [ ] **Step 3**: `BooleanField` (Radix Switch)
  - File(s): `src/features/property-grid/fields/BooleanField.tsx`, `tests/unit/features/property-grid/fields/BooleanField.test.tsx`
  - Contents: Radix `Switch` with `aria-label` from schema description.
  - Test: 100% — toggle state; keyboard activation (Space).
  - Effort: 1h

- [ ] **Step 4**: `EnumField` (Radix Select)
  - File(s): `src/features/property-grid/fields/EnumField.tsx`, `tests/unit/features/property-grid/fields/EnumField.test.tsx`
  - Contents: Options from `ZodEnum` values; default from schema; keyboard navigation (arrows, Enter).
  - Test: 100% — options rendered; selection; keyboard only.
  - Effort: 2h

- [ ] **Step 5**: `ArrayField` with add/remove/reorder
  - File(s): `src/features/property-grid/fields/ArrayField.tsx`, `tests/unit/features/property-grid/fields/ArrayField.test.tsx`
  - Contents: Render each item recursively via `SchemaForm`; "+" adds default item; "×" removes; drag handle reorders (uses `dnd-kit`); stable item keys via nanoid.
  - Test: 100% — add appends; remove by index; reorder; errors aggregate to array.
  - Effort: 4h

- [ ] **Step 6**: `ObjectField` (nested, collapsible)
  - File(s): `src/features/property-grid/fields/ObjectField.tsx`, `tests/unit/features/property-grid/fields/ObjectField.test.tsx`
  - Contents: `<details>`-like disclosure; nested `SchemaForm`; nested errors aggregate to parent with count.
  - Test: 100% — collapse persists (session-storage); nested validation.
  - Effort: 3h

- [ ] **Step 7**: `CodeField` (multi-line, lazy-loaded)
  - File(s): `src/features/property-grid/fields/CodeField.tsx`, `tests/unit/features/property-grid/fields/CodeField.test.tsx`
  - Contents: Lazy-import Monaco; read-only worker; skeleton placeholder during load; language hint from schema (`{ language: 'javascript' }`).
  - Test: 100% — renders value; height responsive; lazy-load guard works in jsdom (mock Monaco).
  - Effort: 4h

- [ ] **Step 8**: `SecretField` (masked + reveal + copy; never in autosave raw)
  - File(s): `src/features/property-grid/fields/SecretField.tsx`, `src/features/persistence/useAutoSave.ts` (hook in scrub), `tests/unit/features/property-grid/fields/SecretField.test.tsx`
  - Contents: `<input type="password">` by default; reveal button toggles `type="text"`; copy button copies to clipboard + toast; autosave replaces value with `"<secret>"` sentinel.
  - Test: 100% — masked by default; reveal accessible; copy fires toast; autosave payload contains sentinel.
  - Effort: 2h

## Acceptance for Stage 2
- All 8 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/property-grid/fields/**`.
- axe-core clean for each field in isolation.
