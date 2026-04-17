import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";

export interface RegistrySlice {
  nodeTypes: Record<string, unknown>;
  registerNodeType: (name: string, definition: unknown) => void;
}

export function createRegistrySlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): RegistrySlice {
  return {
    nodeTypes: {},
    registerNodeType: (name: string, definition: unknown) => {
      set((state) => ({
        nodeTypes: { ...state.nodeTypes, [name]: definition },
      }));
    },
  };
}
