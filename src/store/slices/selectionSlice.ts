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
  /** Set of selected edge IDs */
  selectedEdges: Set<string>;
  /** Select a single node with mode: replace (exclusive), add, or toggle */
  select: (id: string, mode: SelectMode) => void;
  /** Select a single edge with mode: replace (exclusive), add, or toggle */
  selectEdge: (id: string, mode: SelectMode) => void;
  /** Select multiple nodes (replaces current selection) */
  selectMany: (ids: string[]) => void;
  /** Clear node selection */
  clear: () => void;
  /** Clear edge selection */
  clearEdges: () => void;
  /** Check if a node is selected */
  isSelected: (id: string) => boolean;
  /** Check if an edge is selected */
  isEdgeSelected: (id: string) => boolean;
  /** Legacy bulk selection (both nodes and edges) */
  selectBulk: (nodeIds: string[], edgeIds: string[]) => void;
  /** Legacy clear (both nodes and edges) */
  clearSelection: () => void;
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
    selectedEdges: new Set<string>(),
    select: (id: string, mode: SelectMode) => {
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
    selectEdge: (id: string, mode: SelectMode) => {
      const prev = get().selectedEdges;
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
      set({ selectedEdges: next, selectedEdgeIds: setToArray(next) });
    },
    selectMany: (ids: string[]) => {
      const next = new Set(ids);
      set({ selected: next, selectedNodeIds: setToArray(next) });
    },
    clear: () => {
      set({ selected: new Set<string>(), selectedNodeIds: [] });
    },
    clearEdges: () => {
      set({ selectedEdges: new Set<string>(), selectedEdgeIds: [] });
    },
    isSelected: (id: string) => {
      return get().selected.has(id);
    },
    isEdgeSelected: (id: string) => {
      return get().selectedEdges.has(id);
    },
    selectBulk: (nodeIds: string[], edgeIds: string[]) => {
      const selected = new Set(nodeIds);
      const selectedEdges = new Set(edgeIds);
      set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds, selected, selectedEdges });
    },
    clearSelection: () => {
      set({
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selected: new Set<string>(),
        selectedEdges: new Set<string>(),
      });
    },
  };
}
