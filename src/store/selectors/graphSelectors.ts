import { shallowEqual } from "fast-equals";
import type { WorkflowState } from "@/store/createStore";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const cache = new Map<string, NodeSpec | undefined>();

/** Cache for selectIsPortMissing: tracks last edges reference + per-port results. */
let portMissingEdgesRef: readonly unknown[] | null = null;
const portMissingCache = new Map<string, boolean>();

/**
 * Memoized selector that resolves a NodeSpec by kind from the store's
 * registry. Returns the same reference when the resolved spec has not
 * changed (shallow equality via fast-equals), keeping downstream React
 * renders stable across unrelated state changes.
 */
export function selectNodeSpec(state: WorkflowState, kind: string): NodeSpec | undefined {
  const next = state.registry.get(kind);
  const prev = cache.get(kind);

  if (prev !== undefined && next !== undefined && shallowEqual(prev, next)) {
    return prev;
  }

  // undefined→undefined stability
  if (prev === undefined && next === undefined) {
    return undefined;
  }

  cache.set(kind, next);
  return next;
}

/**
 * Returns true if the given input port is required and has no inbound edge.
 * Used to show a "missing" indicator on required, unconnected input handles.
 *
 * Memoized: caches results per (nodeId, portId) pair and invalidates when
 * the edges array reference changes.
 */
export function selectIsPortMissing(
  state: WorkflowState,
  nodeId: string,
  portId: string,
  required?: boolean,
): boolean {
  if (!required) return false;

  // Invalidate cache when edges array reference changes
  if (state.edges !== portMissingEdgesRef) {
    portMissingEdgesRef = state.edges;
    portMissingCache.clear();
  }

  const key = `${nodeId}\0${portId}`;
  const cached = portMissingCache.get(key);
  if (cached !== undefined) return cached;

  const result = !state.edges.some((e) => e.target === nodeId && e.targetPort === portId);
  portMissingCache.set(key, result);
  return result;
}

/** Reset the memoization cache (useful in tests). */
export function clearSelectorCache(): void {
  cache.clear();
  portMissingEdgesRef = null;
  portMissingCache.clear();
}
