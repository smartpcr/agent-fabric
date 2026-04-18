import { createStore as zustandCreateStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";
import { createGraphSlice, type GraphSlice } from "@/store/slices/graphSlice";
import { createSelectionSlice, type SelectionSlice } from "@/store/slices/selectionSlice";
import { createRegistrySlice, type RegistrySlice } from "@/store/slices/registrySlice";
import { createExecutionSlice, type ExecutionSlice } from "@/store/slices/executionSlice";
import { createViewportSlice, type ViewportSlice } from "@/store/slices/viewportSlice";

export const UNDO_LIMIT = 50;

export type WorkflowState = GraphSlice &
  SelectionSlice &
  RegistrySlice &
  ExecutionSlice &
  ViewportSlice;

export function createStore() {
  return zustandCreateStore<WorkflowState>()(
    temporal(
      immer((_set, _get, api) => {
        const setState: typeof api.setState = (...args) => {
          api.setState(...args);
        };
        const getState: typeof api.getState = () => api.getState();
        return {
          ...createGraphSlice(setState, getState),
          ...createSelectionSlice(setState, getState),
          ...createRegistrySlice(setState, getState),
          ...createExecutionSlice(setState, getState),
          ...createViewportSlice(setState, getState),
        };
      }),
      {
        limit: UNDO_LIMIT,
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
        }),
        equality: (pastState, currentState) =>
          pastState.nodes === currentState.nodes && pastState.edges === currentState.edges,
      },
    ),
  );
}
