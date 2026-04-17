import { type StoreApi } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { createStore, type WorkflowState } from "@/store/createStore";

let defaultStore: StoreApi<WorkflowState> | null = null;

function getDefaultStore(): StoreApi<WorkflowState> {
  if (defaultStore === null) {
    defaultStore = createStore();
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
