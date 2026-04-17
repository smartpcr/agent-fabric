import { type StoreApi } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { TemporalState } from "zundo";
import { createStore, type WorkflowState } from "@/store/createStore";

type StoreWithTemporal = StoreApi<WorkflowState> & {
  temporal: StoreApi<TemporalState<Pick<WorkflowState, "nodes" | "edges">>>;
};

let defaultStore: StoreWithTemporal | null = null;

function getDefaultStore(): StoreWithTemporal {
  if (defaultStore === null) {
    defaultStore = createStore() as StoreWithTemporal;
  }
  return defaultStore;
}

export function useWorkflowStore(): WorkflowState;
export function useWorkflowStore<T>(
  selector: (state: WorkflowState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T;
export function useWorkflowStore<T>(
  selector?: (state: WorkflowState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): WorkflowState | T {
  const store = getDefaultStore();
  return useStoreWithEqualityFn(store, selector as (state: WorkflowState) => T, equalityFn);
}

/**
 * Access the temporal (undo/redo) store.
 * Returns `{ undo, redo, clear, pastStates, futureStates }`.
 */
export function useTemporalStore(): TemporalState<Pick<WorkflowState, "nodes" | "edges">>;
export function useTemporalStore<T>(
  selector: (state: TemporalState<Pick<WorkflowState, "nodes" | "edges">>) => T,
): T;
export function useTemporalStore<T>(
  selector?: (state: TemporalState<Pick<WorkflowState, "nodes" | "edges">>) => T,
): TemporalState<Pick<WorkflowState, "nodes" | "edges">> | T {
  const store = getDefaultStore();
  return useStoreWithEqualityFn(
    store.temporal,
    selector as (state: TemporalState<Pick<WorkflowState, "nodes" | "edges">>) => T,
  );
}
