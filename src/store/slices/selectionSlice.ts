import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";

export type SelectMode = "replace" | "add" | "toggle";

export interface SelectionSlice {
  /** Legacy: array of selected node IDs */
  selectedNodeIds: string[];
  /** Legacy: array of selected edge IDs */
  selectedEdgeIds: string[];
  /** Set of selected node IDs */
  selected: Set<string>;
  /** Legacy bulk selection */
  select: (nodeIds: string[], edgeIds: string[]) => void;
  /** Legacy clear */
  clearSelection: () => void;
  /** Select a single node with mode: replace (exclusive), add, or toggle */
  selectNode: (id: string, mode: SelectMode) => void;
  /** Select multiple nodes (replaces current selection) */
  selectMany: (ids: string[]) => void;
  /** Clear node selection */
  clearNodeSelection: () => void;
  /** Check if a node is selected */
  isSelected: (id: string) => boolean;
}

function setToArray(s: Set<string>): string[] {
  return [...s];
}

export function createSelectionSlice(
  set: StoreApi<WorkflowState>["setState"],
  get: StoreApi<WorkflowState>["getState"],
): SelectionSlice {
  return {
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selected: new Set<string>(),
    select: (nodeIds: string[], edgeIds: string[]) => {
      const selected = new Set(nodeIds);
      set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds, selected });
    },
    clearSelection: () => {
      set({ selectedNodeIds: [], selectedEdgeIds: [], selected: new Set<string>() });
    },
    selectNode: (id: string, mode: SelectMode) => {
      const prev = get().selected;
      let next: Set<string>;
      if (mode === "replace") {
        next = new Set([id]);
      } else if (mode === "add") {
        next = new Set(prev);
        next.add(id);
      } else {
        // toggle
        next = new Set(prev);
        if (next.has(id)) {
          next["delete"](id);
        } else {
          next.add(id);
        }
      }
      set({ selected: next, selectedNodeIds: setToArray(next) });
    },
    selectMany: (ids: string[]) => {
      const next = new Set(ids);
      set({ selected: next, selectedNodeIds: setToArray(next) });
    },
    clearNodeSelection: () => {
      set({ selected: new Set<string>(), selectedNodeIds: [] });
    },
    isSelected: (id: string) => {
      return get().selected.has(id);
    },
  };
}
