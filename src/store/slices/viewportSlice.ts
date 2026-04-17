import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";

export interface ViewportSlice {
  zoom: number;
  panX: number;
  panY: number;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
}

export function createViewportSlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): ViewportSlice {
  return {
    zoom: 1,
    panX: 0,
    panY: 0,
    setZoom: (zoom: number) => {
      set({ zoom });
    },
    setPan: (x: number, y: number) => {
      set({ panX: x, panY: y });
    },
  };
}
