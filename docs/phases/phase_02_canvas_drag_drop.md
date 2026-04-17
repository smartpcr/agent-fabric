# Phase 2 — Canvas, Drag-Drop & Selection
> Part of [Workflow UI Implementation Plan](../workflow-ui-plan.md)

**Goal**: Fully interactive canvas. Users drag components from a palette onto the canvas, move nodes, select (single + multi + lasso), delete with keyboard, pan/zoom/fit-view/mini-map, snap-to-grid, all with visible accessible affordances and undo.

**Status**: `[ ]` not started · **Effort**: 80h · **Completed**: 0h · **Progress**: 0%

## Exit Criteria

1. Dragging a palette item onto the canvas creates a node at the drop point.
2. Nodes can be moved; selected (single + shift-click multi + lasso); deleted via keyboard.
3. Viewport controls (pan/zoom/fit/mini-map) work and are keyboard-accessible.
4. Integration test builds a 3-node sequence using only UI interactions.
5. E2E smoke on all three browsers passes.

## Stages

| # | Stage | Document | Steps | Effort (h) | Status |
|---|-------|----------|------:|-----------:|--------|
| 1 | Palette | [stage_01_palette.md](phase_02_canvas_drag_drop/stage_01_palette.md) | 6 | 16 | `[ ]` |
| 2 | Drop Target & Node Creation | [stage_02_drop_target.md](phase_02_canvas_drag_drop/stage_02_drop_target.md) | 7 | 14 | `[ ]` |
| 3 | Custom Node Chrome | [stage_03_custom_node_chrome.md](phase_02_canvas_drag_drop/stage_03_custom_node_chrome.md) | 5 | 12 | `[ ]` |
| 4 | Selection & Deletion | [stage_04_selection_deletion.md](phase_02_canvas_drag_drop/stage_04_selection_deletion.md) | 5 | 12 | `[ ]` |
| 5 | Viewport & Controls | [stage_05_viewport_controls.md](phase_02_canvas_drag_drop/stage_05_viewport_controls.md) | 6 | 14 | `[ ]` |
| 6 | Phase 2 E2E | [stage_06_e2e.md](phase_02_canvas_drag_drop/stage_06_e2e.md) | 5 | 12 | `[ ]` |
| **Total** | | | **29** | **80** | `[ ]` 0% |

## Architectural Notes

- **Pointer-based drag, not HTML5 DnD** — HTML5 DnD has cross-browser inconsistencies (Firefox, Safari quirks). Pointer events + `setPointerCapture` work uniformly and match xyflow's own pointer-first interaction model.
- **Drop coordinates** — always convert client → flow coordinates via `useReactFlow().screenToFlowPosition({x, y})`; raw viewport math is tempting but wrong under zoom.
- **Selection set lives in `selectionSlice`** — not in `graphSlice`, so selection changes don't pollute undo history.
- **Node chrome via `BaseNode`** — shared header, body slot, focus ring, `aria-selected`. Per-kind components (`TaskNode`, `StartNode`) compose `BaseNode` rather than reimplementing chrome.
- **xyflow change events** are funneled through `applyNodeChanges` / `applyEdgeChanges` actions so zundo captures them as a single logical drag.

## Risk Log

- **Drag performance on large palettes** → virtualize with `@tanstack/react-virtual` (Stage 1).
- **Lasso + existing xyflow selection** → use xyflow's `selectionMode: 'partial'` with custom box-select overlay; tested on all three browsers.

## Definition of Done

- All 29 steps `[x]` with score ≥ 90.
- Integration test: "build 3-node chain" is part of `tests/integration/`.
- E2E on Chromium/Firefox/WebKit all green.
- axe-core shows zero violations on the editor page.
