import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";

export type ExecutionStatus = "idle" | "running" | "paused" | "completed" | "failed";

export interface ExecutionSlice {
  executionStatus: ExecutionStatus;
  executionLog: unknown[];
  startExecution: () => void;
  stopExecution: () => void;
}

export function createExecutionSlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): ExecutionSlice {
  return {
    executionStatus: "idle",
    executionLog: [],
    startExecution: () => {
      set({ executionStatus: "running" });
    },
    stopExecution: () => {
      set({ executionStatus: "idle", executionLog: [] });
    },
  };
}
