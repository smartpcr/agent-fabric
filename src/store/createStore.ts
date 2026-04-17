import { createStore as zustandCreateStore } from "zustand/vanilla";
import { temporal } from "zundo";
import { createGraphSlice, type GraphSlice } from "@/store/slices/graphSlice";
import { createSelectionSlice, type SelectionSlice } from "@/store/slices/selectionSlice";
import { createRegistrySlice, type RegistrySlice } from "@/store/slices/registrySlice";
import { createExecutionSlice, type ExecutionSlice } from "@/store/slices/executionSlice";
import { createViewportSlice, type ViewportSlice } from "@/store/slices/viewportSlice";

export type WorkflowState = GraphSlice &
  SelectionSlice &
  RegistrySlice &
  ExecutionSlice &
  ViewportSlice;

export function createStore() {
  return zustandCreateStore<WorkflowState>()(
    temporal(
      (set, get, api) => ({
        ...createGraphSlice(api.setState, api.getState),
        ...createSelectionSlice(api.setState, api.getState),
        ...createRegistrySlice(api.setState, api.getState),
        ...createExecutionSlice(api.setState, api.getState),
        ...createViewportSlice(api.setState, api.getState),
      }),
      {
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
        }),
      },
    ),
  );
}
