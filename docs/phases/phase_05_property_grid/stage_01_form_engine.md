# Phase 5 — Stage 1: Form Engine

> SchemaForm that introspects Zod schemas and renders registered field components; react-hook-form integration with debounced commit.
> Status: `[x]` complete · **Effort**: 16h

## Steps

- [x] **Step 1**: `SchemaForm` component
  - File(s): `src/features/property-grid/SchemaForm.tsx`, `tests/unit/features/property-grid/SchemaForm.test.tsx`
  - Contents: Props `{ schema: ZodSchema, value, onChange }`; introspects schema → renders tree of fields via registry; tracks form state via `react-hook-form`.
  - Test: 100% — renders a simple flat schema; `onChange` fires on field edit.
  - Effort: 4h

- [x] **Step 2**: Zod schema introspection
  - File(s): `src/features/property-grid/introspect.ts`, `tests/unit/features/property-grid/introspect.test.ts`
  - Contents: `introspect(schema): FieldDescriptor[]`; handles `ZodString`, `ZodNumber`, `ZodBoolean`, `ZodEnum`, `ZodObject`, `ZodArray`, `ZodOptional`, `ZodDefault`, `ZodRecord`.
  - Test: 100% — each Zod type → correct descriptor; unwrap Optional/Default.
  - Effort: 3h

- [x] **Step 3**: Field registry
  - File(s): `src/features/property-grid/registry.ts`, `tests/unit/features/property-grid/registry.test.ts`
  - Contents: `registerField(type, component)`, `resolveField(descriptor)`; descriptor-level override (`fieldName → component`) beats type-level; unknown falls back to `StringField`.
  - Test: 100% — resolution order; override precedence; fallback.
  - Effort: 2h

- [x] **Step 4**: `react-hook-form` + `zodResolver` wiring
  - File(s): `src/features/property-grid/SchemaForm.tsx` (extend), `tests/unit/features/property-grid/SchemaForm.validation.test.tsx`
  - Contents: Inline validation via `zodResolver`; errors surfaced per field; `mode: 'onChange'`.
  - Test: 100% — invalid value shows error; corrected value clears error.
  - Effort: 4h

- [x] **Step 5**: Debounced commit (300ms) with cancel on unmount
  - File(s): `src/features/property-grid/useDebouncedCommit.ts`, `tests/unit/features/property-grid/useDebouncedCommit.test.ts`
  - Contents: Collects changes; after 300ms idle, calls `onCommit`; on unmount, flushes only if the component was unmounted cleanly (not on error).
  - Test: 100% — fake timers; rapid edits coalesced; unmount cancels pending commit.
  - Effort: 3h

## Acceptance for Stage 1

- All 5 steps `[x]` with score ≥ 90.
- 100% unit coverage on form engine.
- No memory leaks on rapid schema switching (verified via test lifecycle).
