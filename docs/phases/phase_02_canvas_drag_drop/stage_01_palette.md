# Phase 2 — Stage 1: Palette

> A virtualized, categorized, keyboard-accessible palette of node types the user drags onto the canvas.
> Status: `[ ]` not started · **Effort**: 16h

## Steps

- [x] **Step 1**: Palette shell with categories + virtualization
  - File(s): `src/features/palette/Palette.tsx`, `src/features/palette/PaletteCategory.tsx`
  - Contents: Reads registry via `useWorkflowStore(s => s.registry.list())`; groups by `category`; `@tanstack/react-virtual` for rows; collapsible sections; `role="listbox"` on list, `role="option"` per item.
  - Test: Component test asserts categories render; virtualization active (only visible items in DOM); keyboard navigation moves focus through options.
  - Effort: 3h

- [x] **Step 2**: `PaletteItem` with icon, label, description, drag handle
  - File(s): `src/features/palette/PaletteItem.tsx`
  - Contents: Renders lucide icon (from `spec.icon`); tooltip (Radix) shows description on hover + focus; disabled state for gated specs.
  - Test: 100% — ARIA role `option`; accessible name = label; tooltip appears.
  - Effort: 2h

- [ ] **Step 3**: Pointer-based drag source (`useDragStart`)
  - File(s): `src/features/palette/useDragStart.ts`, `src/features/palette/DragContext.tsx`, `tests/unit/features/palette/useDragStart.test.ts`
  - Contents: Pointer-down captures; records `startX/Y`; on movement > 3px threshold, enters "dragging" state and sets global drag payload `{ kind }`; `Escape` cancels; pointer-up ends drag.
  - Test: 100% — full pointer capture lifecycle; threshold enforced; Escape cancels.
  - Effort: 4h

- [ ] **Step 4**: Search / filter palette items (debounced)
  - File(s): `src/features/palette/Palette.tsx` (extend), `src/features/palette/useDebounce.ts`, `tests/unit/features/palette/Palette.search.test.tsx`
  - Contents: Text input above list; 150ms debounce; case-insensitive match against `spec.label` and `spec.category`; empty-state message.
  - Test: 100% — filters narrow list; typing resets count; empty query shows all.
  - Effort: 3h

- [ ] **Step 5**: Keyboard insertion (Enter on focused item adds node to canvas center)
  - File(s): `src/features/palette/Palette.tsx` (extend), `src/store/slices/graphSlice.ts` (wire), `tests/integration/palette.keyboard-insert.test.tsx`
  - Contents: On `Enter` while a palette item is focused, dispatch `addNode(kind, viewportCenter)`; viewport center computed via `useReactFlow().getViewport()`.
  - Test: 100% (unit) + integration — dispatched action creates node at expected position.
  - Effort: 2h

- [ ] **Step 6**: Integration — registered specs appear grouped in palette
  - File(s): `tests/integration/palette.registry.test.tsx`
  - Contents: Register builtins, mount `Palette`, assert 3 items across 2+ categories with correct labels.
  - Test: Green in CI.
  - Effort: 2h

## Acceptance for Stage 1

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/palette/**`.
- Palette is keyboard-only navigable; axe-core clean.
