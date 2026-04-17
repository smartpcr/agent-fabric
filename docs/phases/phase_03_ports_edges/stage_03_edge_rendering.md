# Phase 3 — Stage 3: Edge Rendering

> Custom edge components with labels, inline editing, selection, deletion, and the edge-type map.
> Status: `[ ]` not started · **Effort**: 16h

## Steps

- [x] **Step 1**: `DefaultEdge` with bezier routing + arrow marker
  - File(s): `src/features/edges/DefaultEdge.tsx`, `tests/unit/features/edges/DefaultEdge.test.tsx`
  - Contents: xyflow `getBezierPath`; `<BaseEdge path={...} markerEnd={...}/>`; arrow-head via `<defs><marker>...`.
  - Test: 100% — path rendered; marker-end attribute set.
  - Effort: 3h

- [x] **Step 2**: Edge label rendering (`EdgeLabelRenderer`)
  - File(s): `src/features/edges/DefaultEdge.tsx` (extend), `tests/unit/features/edges/DefaultEdge.label.test.tsx`
  - Contents: Label rendered at midpoint; truncated to 20 chars with ellipsis; `title` attribute for full value.
  - Test: 100% — label visible at midpoint; truncation; hover title.
  - Effort: 2h

- [x] **Step 3**: Inline edge label editing (double-click → input)
  - File(s): `src/features/edges/InlineLabelEditor.tsx`, `tests/unit/features/edges/InlineLabelEditor.test.tsx`
  - Contents: Double-click replaces label with `<input>`; Enter commits, Escape cancels, Blur commits; focus-trap inside input.
  - Test: 100% — Enter commits, Escape cancels; store receives `updateEdgeLabel` on commit.
  - Effort: 3h

- [ ] **Step 4**: Edge selection (single + shift-multi)
  - File(s): `src/store/slices/selectionSlice.ts` (extend), `src/features/canvas/Canvas.tsx` (extend), `tests/unit/store/slices/selectionSlice.edge.test.ts`
  - Contents: Add `selectedEdges: Set<string>`; click on edge selects; shift-click adds.
  - Test: 100% — selection state correct; deselect on canvas click.
  - Effort: 2h

- [ ] **Step 5**: Edge deletion via keyboard
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `src/store/slices/graphSlice.ts` (extend), `tests/integration/edges.delete.test.tsx`
  - Contents: Delete/Backspace removes selected edges; undoable.
  - Test: Integration — selected edge + Delete → removed; undo restores.
  - Effort: 2h

- [ ] **Step 6**: `edgeTypes` map + `ConditionalEdge` placeholder
  - File(s): `src/features/canvas/edgeTypes.tsx`, `src/features/edges/ConditionalEdge.tsx`, `tests/unit/features/canvas/edgeTypes.test.tsx`
  - Contents: Map `{ default: DefaultEdge, 'loop-back': DefaultEdge, conditional: ConditionalEdge }`; `ConditionalEdge` is a stub rendering `DefaultEdge` with a label chip (filled out in Phase 4).
  - Test: 100% — lookup by edge `kind`.
  - Effort: 2h

- [ ] **Step 7**: Integration — 2-in / 3-out TaskNode with 3 distinct edges
  - File(s): `tests/integration/edges.multiport-connections.test.tsx`
  - Contents: Using multi-port fixture, connect 3 output ports; assert 3 distinct edges in state with unique port ids.
  - Test: Green.
  - Effort: 2h

## Acceptance for Stage 3

- All 7 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/edges/**`.
- Edge labels editable inline with keyboard commit/cancel.
