import { shallowEqual } from "fast-equals";
import type { WorkflowState } from "@/store/createStore";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const cache = new Map<string, NodeSpec | undefined>();

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
 */
export function selectIsPortMissing(
  state: WorkflowState,
  nodeId: string,
  portId: string,
  required?: boolean,
): boolean {
  if (!required) return false;
  return !state.edges.some((e) => e.target === nodeId && e.targetPort === portId);
}

/** Reset the memoization cache (useful in tests). */
export function clearSelectorCache(): void {
  cache.clear();
}
