# Phase 5 — Property Grid (Schema-Driven Editor)
> Part of [Workflow UI Implementation Plan](../workflow-ui-plan.md)

**Goal**: Selecting a node shows a property grid built from its Zod schema. Supports 8 field types, inline validation, debounced commit, keyboard-only editing, and integrates with undo/redo.

**Status**: `[ ]` not started · **Effort**: 70h · **Completed**: 0h · **Progress**: 0%

## Exit Criteria

1. Selecting a `TaskNode` shows a form matching its schema; edits update `node.data` in the store after 300ms debounce.
2. All 8 field types render correctly and surface validation errors inline.
3. Form supports nested objects and arrays (add / remove / reorder).
4. Multi-select editing: common fields editable; differing fields shown as "mixed".
5. Form re-hydrates correctly on undo/redo.

## Stages

| # | Stage | Document | Steps | Effort (h) | Status |
|---|-------|----------|------:|-----------:|--------|
| 1 | Form Engine | [stage_01_form_engine.md](phase_05_property_grid/stage_01_form_engine.md) | 5 | 16 | `[ ]` |
| 2 | Field Primitives | [stage_02_field_primitives.md](phase_05_property_grid/stage_02_field_primitives.md) | 8 | 20 | `[ ]` |
| 3 | Property Grid Integration | [stage_03_grid_integration.md](phase_05_property_grid/stage_03_grid_integration.md) | 7 | 20 | `[ ]` |
| 4 | Phase 5 E2E | [stage_04_e2e.md](phase_05_property_grid/stage_04_e2e.md) | 5 | 14 | `[ ]` |
| **Total** | | | **25** | **70** | `[ ]` 0% |

## Architectural Notes

- **Zod is the single source of truth** — the same schema used by `validateNodeData` (Phase 1) also drives form rendering. Changes to a node's spec automatically propagate to the grid.
- **Field registry** — `fieldType → component`. Consumers override by registering a custom component for a specific field name or type. Keeps the core small and extensible.
- **Debounced commit** — 300ms via `useDebounce`; cancels on unmount to avoid writing to an unmounted store from a stale closure.
- **`react-hook-form` for form state** — keeps uncontrolled inputs (fast) with validation via `zodResolver`.
- **Multi-select edit** — form computes "common" vs "mixed" fields; edits to common fields dispatch to every selected node.

## Risk Log

- **Monaco bundle size for CodeField** → lazy-import; skeleton placeholder while loading.
- **Nested array diffing cost** → use stable keys (nanoid per item) to avoid React re-renders on reorder.

## Definition of Done

- All 25 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/property-grid/**`.
- E2E: edit name, invalid number, array add/remove, multi-select, all pass.
- axe-core clean on property grid panel.
