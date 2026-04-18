import { shallowEqual } from "fast-equals";
import type { WorkflowState } from "@/store/createStore";
import type { NodeExecutionState, EdgeExecutionState } from "@/store/slices/executionSlice";

// ─── Memoization caches ──────────────────────────────────────────────

const nodeCache = new Map<string, NodeExecutionState | undefined>();
const edgeCache = new Map<string, EdgeExecutionState | undefined>();

function compositeKey(a: string, b: string): string {
  return `${a}\0${b}`;
}

/**
 * Memoized selector that returns the execution state of a specific node
 * within a run. Returns the same reference when the resolved state has
 * not changed (shallow equality via fast-equals), keeping downstream
 * React renders stable across unrelated state changes.
 */
export function selectNodeExecutionState(
  state: WorkflowState,
  runId: string,
  nodeId: string,
): NodeExecutionState | undefined {
  const key = compositeKey(runId, nodeId);
  const next = state.runs.get(runId)?.nodes.get(nodeId);
  const prev = nodeCache.get(key);

  if (prev === undefined && next === undefined) {
    return undefined;
  }

  if (prev !== undefined && next !== undefined && shallowEqual(prev, next)) {
    return prev;
  }

  nodeCache.set(key, next);
  return next;
}

/**
 * Memoized selector that returns the execution state of a specific edge
 * within a run. Returns the same reference when the resolved state has
 * not changed (shallow equality via fast-equals), keeping downstream
 * React renders stable across unrelated state changes.
 */
export function selectEdgeExecutionState(
  state: WorkflowState,
  runId: string,
  edgeId: string,
): EdgeExecutionState | undefined {
  const key = compositeKey(runId, edgeId);
  const next = state.runs.get(runId)?.edges.get(edgeId);
  const prev = edgeCache.get(key);

  if (prev === undefined && next === undefined) {
    return undefined;
  }

  if (prev !== undefined && next !== undefined && shallowEqual(prev, next)) {
    return prev;
  }

  edgeCache.set(key, next);
  return next;
}

/** Reset the memoization caches (useful in tests). */
export function clearExecutionSelectorCache(): void {
  nodeCache.clear();
  edgeCache.clear();
}
