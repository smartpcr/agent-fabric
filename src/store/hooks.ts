import { type StoreApi } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { TemporalState } from "zundo";
import { createStore, type WorkflowState } from "@/store/createStore";

export type TemporalSlice = Pick<WorkflowState, "nodes" | "edges">;

type StoreWithTemporal = StoreApi<WorkflowState> & {
  temporal: StoreApi<TemporalState<TemporalSlice>>;
};

let defaultStore: StoreWithTemporal | null = null;

function getDefaultStore(): StoreWithTemporal {
  if (defaultStore === null) {
    defaultStore = createStore() as StoreWithTemporal;
  }
  return defaultStore;
}

/** Get the singleton store instance (useful for test harnesses). */
export function getStoreInstance(): StoreApi<WorkflowState> {
  return getDefaultStore();
}

/** Reset the singleton store (for test isolation). */
export function resetDefaultStore(): void {
  defaultStore = createStore() as StoreWithTemporal;
}

// ─── useWorkflowStore hook with .temporal property ───────────────────

interface UseWorkflowStoreHook {
  (): WorkflowState;
  <T>(selector: (state: WorkflowState) => T, equalityFn?: (a: T, b: T) => boolean): T;
  /** Direct access to the temporal (undo/redo) store API. */
  temporal: StoreApi<TemporalState<TemporalSlice>>;
}

function useWorkflowStoreImpl(): WorkflowState;
function useWorkflowStoreImpl<T>(
  selector?: (state: WorkflowState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): WorkflowState | T;
function useWorkflowStoreImpl<T>(
  selector?: (state: WorkflowState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): WorkflowState | T {
  const store = getDefaultStore();
  return useStoreWithEqualityFn(store, selector as (state: WorkflowState) => T, equalityFn);
}

/**
 * Zustand hook for accessing the workflow store.
 *
 * Also exposes `useWorkflowStore.temporal` for direct access to the
 * temporal (undo/redo) store API:
 * ```
 * useWorkflowStore.temporal.getState().undo()
 * useWorkflowStore.temporal.getState().redo()
 * ```
 */
export const useWorkflowStore: UseWorkflowStoreHook = Object.defineProperty(
  useWorkflowStoreImpl,
  "temporal",
  { get: () => getDefaultStore().temporal },
) as UseWorkflowStoreHook;

/**
 * Access the temporal (undo/redo) store as a React hook.
 * Returns `{ undo, redo, clear, pastStates, futureStates }`.
 */
export function useTemporalStore(): TemporalState<TemporalSlice>;
export function useTemporalStore<T>(selector: (state: TemporalState<TemporalSlice>) => T): T;
export function useTemporalStore<T>(
  selector?: (state: TemporalState<TemporalSlice>) => T,
): TemporalState<TemporalSlice> | T {
  const store = getDefaultStore();
  return useStoreWithEqualityFn(
    store.temporal,
    selector as (state: TemporalState<TemporalSlice>) => T,
  );
}
