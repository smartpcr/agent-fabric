# Selector Memoization Audit — Profiler Report Notes

**Date**: Phase 8, Stage 3, Step 3
**Scope**: `src/store/selectors/**`, node/edge components

## Audit Summary

### Selectors Reviewed

| Selector                   | File                    | Before        | After       | Issue                                    |
| -------------------------- | ----------------------- | ------------- | ----------- | ---------------------------------------- |
| `selectNodeSpec`           | `graphSelectors.ts`     | ✅ Memoized   | ✅ Memoized | Already had shallow-equality cache       |
| `selectIsPortMissing`      | `graphSelectors.ts`     | ❌ Unmemoized | ✅ Memoized | Linear `edges.some()` scan on every call |
| `selectNodeExecutionState` | `executionSelectors.ts` | ✅ Memoized   | ✅ Memoized | Already had shallow-equality cache       |
| `selectEdgeExecutionState` | `executionSelectors.ts` | ✅ Memoized   | ✅ Memoized | Already had shallow-equality cache       |

### Components Reviewed for React.memo

| Component         | File                        | Before     | After       |
| ----------------- | --------------------------- | ---------- | ----------- |
| `TaskNode`        | `nodes/TaskNode.tsx`        | ❌ No memo | ✅ `memo()` |
| `StartNode`       | `nodes/StartNode.tsx`       | ❌ No memo | ✅ `memo()` |
| `EndNode`         | `nodes/EndNode.tsx`         | ❌ No memo | ✅ `memo()` |
| `DecisionNode`    | `nodes/DecisionNode.tsx`    | ❌ No memo | ✅ `memo()` |
| `LoopNode`        | `nodes/LoopNode.tsx`        | ❌ No memo | ✅ `memo()` |
| `DefaultEdge`     | `edges/DefaultEdge.tsx`     | ❌ No memo | ✅ `memo()` |
| `ConditionalEdge` | `edges/ConditionalEdge.tsx` | ❌ No memo | ✅ `memo()` |
| `LoopBackEdge`    | `edges/LoopBackEdge.tsx`    | ❌ No memo | ✅ `memo()` |

## Issues Found & Fixed

### 1. selectIsPortMissing — Unmemoized Linear Scan

**Problem**: Called per input port per render frame. With N nodes × M ports,
this scanned the full edges array on every call without caching. On a 500-node
graph with 499 edges, this produced O(N×M×E) work per frame.

**Fix**: Added a cache keyed by `(nodeId, portId)` that invalidates when the
`edges` array reference changes. This reduces repeated calls within the same
render pass from O(E) each to O(1) for cache hits.

### 2. Node/Edge Components Missing React.memo

**Problem**: All 5 node components and 3 edge components were plain function
components. React Flow calls `nodeTypes[kind]` and `edgeTypes[type]` with
props on every viewport change. Without `memo()`, every pan/zoom triggers
full re-renders of all visible nodes and edges, even when their props haven't
changed.

**Fix**: Wrapped all 8 components in `React.memo()`. For components with
static properties (`DefaultEdge.ARROW_MARKER_ID`, `LoopBackEdge.ARROW_MARKER_ID`),
used `Object.assign` to preserve the static properties on the memoized export.

## Expected Impact

- **Pan/zoom responsiveness**: Node/edge components skip re-render when only
  viewport changes (props unchanged). On a 500-node graph, this eliminates
  ~500 unnecessary component re-renders per frame during pan/zoom.
- **Selector stability**: `selectIsPortMissing` cache eliminates ~500 linear
  scans per render when edges haven't changed.
- **Benchmark**: The 500-node pan/zoom benchmark (Step 2) already achieves
  ≥55 fps; this audit hardens the margin for real-world rendering.

## Test Coverage

- `tests/unit/store/selectors/selectorMemoization.test.ts` — 15 tests covering:
  - Reference stability of all selectors across unrelated state changes
  - Cache invalidation on actual data changes
  - React.memo verification on all node/edge components
