# Phase 2 — Stage 3: Custom Node Chrome

> BaseNode + concrete Task / Start / End React components wired into the xyflow `nodeTypes` map.
> Status: `[ ]` not started · **Effort**: 12h

## Steps

- [x] **Step 1**: `BaseNode` chrome (header, body slot, selection ring)
  - File(s): `src/features/nodes/BaseNode.tsx`, `tests/unit/features/nodes/BaseNode.test.tsx`
  - Contents: Header (title + icon); body slot via `children`; selection ring via `[data-selected="true"]`; `aria-selected`; focus ring on keyboard focus; `tabIndex={0}`.
  - Test: 100% — renders children; selected attribute reflects prop; keyboard focusable.
  - Effort: 3h

- [x] **Step 2**: `StartNode` / `EndNode` React components
  - File(s): `src/features/nodes/StartNode.tsx`, `src/features/nodes/EndNode.tsx`, `tests/unit/features/nodes/StartNode.test.tsx`, `tests/unit/features/nodes/EndNode.test.tsx`
  - Contents: Pill shape; single handle; labels "Start" / "End"; handle position bottom for StartNode, top for EndNode.
  - Test: 100% — renders single handle; ARIA name correct.
  - Effort: 2h

- [x] **Step 3**: `TaskNode` React component
  - File(s): `src/features/nodes/TaskNode.tsx`, `tests/unit/features/nodes/TaskNode.test.tsx`
  - Contents: Title from `data.name`; input handle top-center; output handle bottom-center; icon per `spec.icon`.
  - Test: 100% — title binds to data; handles present; icon lookup.
  - Effort: 3h

- [x] **Step 4**: `nodeTypes` map in Canvas
  - File(s): `src/features/canvas/nodeTypes.tsx`, `src/features/canvas/Canvas.tsx` (extend), `tests/unit/features/canvas/nodeTypes.test.tsx`
  - Contents: Map `{ start: StartNode, end: EndNode, task: TaskNode }`; passed to `<ReactFlow nodeTypes={...}/>`.
  - Test: 100% — xyflow renders the correct component given a node of each kind.
  - Effort: 2h

- [x] **Step 5**: Accessible node focus (Tab traversal, Enter opens inspector stub)
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/integration/nodes.keyboard-focus.test.tsx`
  - Contents: Tab moves between nodes in DOM order; focus ring visible; Enter dispatches `openInspector(nodeId)` (stub for later phase).
  - Test: Integration — Tab twice focuses second node; Enter calls stub.
  - Effort: 2h

## Acceptance for Stage 3

- All 5 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/nodes/**`.
- Keyboard-only traversal of nodes verified.
