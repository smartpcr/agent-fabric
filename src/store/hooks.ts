import { useStore, type StoreApi } from "zustand";
import { createStore, type WorkflowState } from "@/store/createStore";

let defaultStore: StoreApi<WorkflowState> | null = null;

function getDefaultStore(): StoreApi<WorkflowState> {
  if (defaultStore === null) {
    defaultStore = createStore();
  }
  return defaultStore;
}

export function useWorkflowStore(): WorkflowState;
export function useWorkflowStore<T>(selector: (state: WorkflowState) => T): T;
export function useWorkflowStore<T>(selector?: (state: WorkflowState) => T): WorkflowState | T {
  const store = getDefaultStore();
  return useStore(store, selector as (state: WorkflowState) => T);
}
