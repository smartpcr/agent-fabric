import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";

export interface GraphSlice {
  nodes: unknown[];
  edges: unknown[];
  addNode: (node: unknown) => void;
  removeNode: (id: string) => void;
}

export function createGraphSlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): GraphSlice {
  return {
    nodes: [],
    edges: [],
    addNode: (_node: unknown) => {
      set((state) => ({ nodes: [...state.nodes, _node] }));
    },
    removeNode: (_id: string) => {
      set((state) => ({
        nodes: state.nodes.filter((n) => (n as { id: string }).id !== _id),
      }));
    },
  };
}
