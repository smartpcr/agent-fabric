import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";

export interface SelectionSlice {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  select: (nodeIds: string[], edgeIds: string[]) => void;
  clearSelection: () => void;
}

export function createSelectionSlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): SelectionSlice {
  return {
    selectedNodeIds: [],
    selectedEdgeIds: [],
    select: (nodeIds: string[], edgeIds: string[]) => {
      set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds });
    },
    clearSelection: () => {
      set({ selectedNodeIds: [], selectedEdgeIds: [] });
    },
  };
}
