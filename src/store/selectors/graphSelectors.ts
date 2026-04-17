import { shallowEqual } from "fast-equals";
import type { WorkflowState } from "@/store/createStore";
import type { NodeSpec } from "@/domain/models/nodeSpec";

/**
 * Creates a memoized selector that resolves a NodeSpec by kind from
 * the store's registry. Returns the same reference when the resolved
 * spec has not changed (shallow equality via fast-equals), keeping
 * downstream React renders stable across unrelated state changes.
 */
export function selectNodeSpec(state: WorkflowState, kind: string): NodeSpec | undefined {
  return state.registry.get(kind);
}

const cache = new Map<string, NodeSpec | undefined>();

/**
 * Memoized version: returns referentially stable NodeSpec as long as
 * the resolved value is shallow-equal to the previous result for the
 * same kind.
 */
export function selectNodeSpecMemoized(state: WorkflowState, kind: string): NodeSpec | undefined {
  const next = selectNodeSpec(state, kind);
  const prev = cache.get(kind);

  if (prev !== undefined && next !== undefined && shallowEqual(prev, next)) {
    return prev;
  }

  // Also handle undefined→undefined stability
  if (prev === undefined && next === undefined) {
    return undefined;
  }

  cache.set(kind, next);
  return next;
}

/** Reset the memoization cache (useful in tests). */
export function clearSelectorCache(): void {
  cache.clear();
}
