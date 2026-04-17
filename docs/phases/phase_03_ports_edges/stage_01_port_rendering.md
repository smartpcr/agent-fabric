# Phase 3 — Stage 1: Port Rendering

> First-class typed ports rendered as xyflow handles, distributed evenly across node edges, colored by dataType.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: `InputHandle` / `OutputHandle` wrappers
  - File(s): `src/features/nodes/ports/InputHandle.tsx`, `src/features/nodes/ports/OutputHandle.tsx`, `tests/unit/features/nodes/ports/Handle.test.tsx`
  - Contents: Wraps xyflow `<Handle>`; reads `PortSpec`; sets `id = portSpec.id`, `data-port-id`, `aria-label = portSpec.label`; type-based class name for styling.
  - Test: 100% — data attributes present; accessible name = port label; type class applied.
  - Effort: 3h

- [x] **Step 2**: Handle layout engine — distribute N handles along node edges
  - File(s): `src/features/nodes/ports/handleLayout.ts`, `tests/unit/features/nodes/ports/handleLayout.test.ts`
  - Contents: `computeHandlePositions({ count, edge: 'top'|'bottom'|'left'|'right', padding })` returns percentage offsets; evenly spaced; clamped to `[padding, 1-padding]`.
  - Test: 100% — 1 port → 50%; 2 → 33%/67%; 5 → evenly; clamp at extremes.
  - Effort: 3h

- [x] **Step 3**: Handle styling by dataType (color token per type)
  - File(s): `src/features/nodes/ports/handleStyles.ts`, `src/styles/tokens.css` (extend), `tests/unit/features/nodes/ports/handleStyles.test.ts`
  - Contents: Map `dataType → --color-port-X` CSS variable; unknown types fall back to neutral; legend component lists mappings (for Phase 8 docs).
  - Test: 100% — known types map; unknown falls back.
  - Effort: 2h

- [ ] **Step 4**: Handle tooltip (label + dataType + cardinality)
  - File(s): `src/features/nodes/ports/HandleTooltip.tsx`, `tests/unit/features/nodes/ports/HandleTooltip.test.tsx`
  - Contents: Radix tooltip on hover + focus; content `<label> · <dataType> · <cardinality>`.
  - Test: 100% — tooltip appears; content correct; keyboard focus triggers.
  - Effort: 2h

- [ ] **Step 5**: Multi-port TaskNode variant (fixture)
  - File(s): `src/registry/builtins/MultiPortTaskNode.spec.ts`, `tests/fixtures/multiPortSpec.ts`, `tests/unit/registry/builtins/MultiPortTaskNode.test.ts`
  - Contents: kind `'task-multi'`, 2 inputs (`inA: string`, `inB: json`), 3 outputs (`outA: string`, `outB: json`, `outC: any`); registered in a test-only helper.
  - Test: 100% — spec shape; rendering via `TaskNode` produces 5 handles.
  - Effort: 2h

- [ ] **Step 6**: Integration — multi-port node renders 5 handles with correct ARIA names
  - File(s): `tests/integration/nodes.multiport.test.tsx`
  - Contents: Mount with multi-port spec; assert 5 handles; names match spec labels.
  - Test: Green.
  - Effort: 2h

## Acceptance for Stage 1

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/nodes/ports/**`.
- Multi-port fixture added to `tests/fixtures/`.
