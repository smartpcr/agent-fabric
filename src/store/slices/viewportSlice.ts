import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface ViewportSlice {
  zoom: number;
  panX: number;
  panY: number;
  snapEnabled: boolean;
  snapGridSize: number;
  inspectorNodeId: string | null;
  interactive: boolean;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  toggleSnap: () => void;
  setSnapGridSize: (size: number) => void;
  openInspector: (nodeId: string) => void;
  toggleInteractive: () => void;
  /** Serialize current viewport for persistence */
  getViewportState: () => ViewportState;
  /** Restore viewport from persisted state */
  restoreViewport: (state: ViewportState) => void;
}

export function createViewportSlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): ViewportSlice {
  return {
    zoom: 1,
    panX: 0,
    panY: 0,
    snapEnabled: false,
    snapGridSize: 16,
    inspectorNodeId: null,
    interactive: true,
    setZoom: (zoom: number) => {
      set({ zoom });
    },
    setPan: (x: number, y: number) => {
      set({ panX: x, panY: y });
    },
    toggleSnap: () => {
      set((prev) => ({ snapEnabled: !prev.snapEnabled }));
    },
    setSnapGridSize: (size: number) => {
      set({ snapGridSize: size });
    },
    openInspector: (nodeId: string) => {
      set({ inspectorNodeId: nodeId });
    },
    toggleInteractive: () => {
      set((prev) => ({ interactive: !prev.interactive }));
    },
    getViewportState: () => {
      const { panX, panY, zoom } = _get();
      return { x: panX, y: panY, zoom };
    },
    restoreViewport: (state: ViewportState) => {
      set({ panX: state.x, panY: state.y, zoom: state.zoom });
    },
  };
}
