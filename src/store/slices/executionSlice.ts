import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";

// ─── Node / Edge execution state ─────────────────────────────────────

/** Possible execution status values for a single node. */
export type NodeExecutionStatus = "idle" | "running" | "succeeded" | "failed" | "skipped";

/** Per-node execution state within a run. */
export interface NodeExecutionState {
  readonly status: NodeExecutionStatus;
  readonly startedAt?: number;
  readonly finishedAt?: number;
  readonly error?: string;
  readonly iteration?: number;
}

/** Possible execution status values for a single edge. */
export type EdgeExecutionStatus = "idle" | "active" | "taken";

/** Per-edge execution state within a run. */
export interface EdgeExecutionState {
  readonly status: EdgeExecutionStatus;
  readonly activatedAt?: number;
  readonly takenAt?: number;
}

// ─── Run state ───────────────────────────────────────────────────────

/** Aggregate status for an entire run. */
export type RunStatus = "running" | "completed" | "failed" | "cancelled";

/** State of a single execution run, keyed by runId in the runs map. */
export interface RunState {
  readonly nodes: Map<string, NodeExecutionState>;
  readonly edges: Map<string, EdgeExecutionState>;
  readonly status: RunStatus;
  readonly startedAt: number;
  readonly finishedAt?: number;
}

// ─── Slice ───────────────────────────────────────────────────────────

export type ExecutionStatus = "idle" | "running" | "paused" | "completed" | "failed";

export interface ExecutionSlice {
  executionStatus: ExecutionStatus;
  executionLog: unknown[];
  /** Execution runs keyed by runId. Never mutated by authoring actions. */
  runs: Map<string, RunState>;
  /** Currently active run for visualization. */
  activeRunId: string | undefined;

  startExecution: () => void;
  stopExecution: () => void;
  /** Set the active run for visualization. */
  setActiveRun: (runId: string) => void;
  /** Remove a run from the store and clear activeRunId if it matches. */
  clearRun: (runId: string) => void;
}

export function createExecutionSlice(
  set: StoreApi<WorkflowState>["setState"],
  _get: StoreApi<WorkflowState>["getState"],
): ExecutionSlice {
  return {
    executionStatus: "idle",
    executionLog: [],
    runs: new Map(),
    activeRunId: undefined,

    startExecution: () => {
      set({ executionStatus: "running" });
    },
    stopExecution: () => {
      set({ executionStatus: "idle", executionLog: [] });
    },
    setActiveRun: (runId: string) => {
      set({ activeRunId: runId });
    },
    clearRun: (runId: string) => {
      const state = _get();
      const next = new Map(state.runs);
      next["delete"](runId);
      set({
        runs: next,
        activeRunId: state.activeRunId === runId ? undefined : state.activeRunId,
      });
    },
  };
}
