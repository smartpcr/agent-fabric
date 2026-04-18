import type { StoreApi } from "zustand";
import type { WorkflowState } from "@/store/createStore";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

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
  readonly totalIterations?: number;
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

// ─── applyEvent helpers ──────────────────────────────────────────────

/** Update a run's node map, returning a new runs Map. */
function updateNodeInRun(
  runs: Map<string, RunState>,
  runId: string,
  nodeId: string,
  update: NodeExecutionState,
): Map<string, RunState> {
  const run = runs.get(runId);
  if (!run) return runs;
  const nodes = new Map(run.nodes);
  nodes.set(nodeId, update);
  const next = new Map(runs);
  next.set(runId, { ...run, nodes });
  return next;
}

/** Update a run's edge map, returning a new runs Map. */
function updateEdgeInRun(
  runs: Map<string, RunState>,
  runId: string,
  edgeId: string,
  update: EdgeExecutionState,
): Map<string, RunState> {
  const run = runs.get(runId);
  if (!run) return runs;
  const edges = new Map(run.edges);
  edges.set(edgeId, update);
  const next = new Map(runs);
  next.set(runId, { ...run, edges });
  return next;
}

/** Finalize a run with a terminal status + finishedAt. */
function finalizeRun(
  runs: Map<string, RunState>,
  runId: string,
  status: RunStatus,
  at: number,
): Map<string, RunState> {
  const run = runs.get(runId);
  if (!run) return runs;
  const next = new Map(runs);
  next.set(runId, { ...run, status, finishedAt: at });
  return next;
}

// ─── applyEvent pure reducer ─────────────────────────────────────────

/**
 * Pure reducer: given a runs map and an execution event, returns a new runs
 * map with the event applied. Creates a run entry on `run.started`. Sets
 * `finishedAt` on terminal run events (`run.completed`, `run.failed`,
 * `run.cancelled`). Updates node/edge maps based on event type.
 *
 * Unknown event types log a warning and return the state unchanged.
 */
export function applyEvent(
  runs: Map<string, RunState>,
  event: ExecutionEvent,
): Map<string, RunState> {
  const { runId } = event;

  switch (event.type) {
    case "run.started": {
      const next = new Map(runs);
      next.set(runId, {
        nodes: new Map(),
        edges: new Map(),
        status: "running",
        startedAt: event.at,
      });
      return next;
    }

    case "run.completed":
      return finalizeRun(runs, runId, "completed", event.at);

    case "run.failed":
      return finalizeRun(runs, runId, "failed", event.at);

    case "run.cancelled":
      return finalizeRun(runs, runId, "cancelled", event.at);

    case "node.started":
      return updateNodeInRun(runs, runId, event.nodeId, {
        status: "running",
        startedAt: event.at,
        iteration: event.payload?.iteration,
      });

    case "node.succeeded":
      return updateNodeInRun(runs, runId, event.nodeId, {
        ...runs.get(runId)?.nodes.get(event.nodeId),
        status: "succeeded",
        finishedAt: event.at,
      });

    case "node.failed":
      return updateNodeInRun(runs, runId, event.nodeId, {
        ...runs.get(runId)?.nodes.get(event.nodeId),
        status: "failed",
        finishedAt: event.at,
        error: event.payload?.error,
      });

    case "node.skipped":
      return updateNodeInRun(runs, runId, event.nodeId, { status: "skipped" });

    case "edge.activated":
      return updateEdgeInRun(runs, runId, event.edgeId, {
        status: "active",
        activatedAt: event.at,
      });

    case "edge.taken":
      return updateEdgeInRun(runs, runId, event.edgeId, {
        ...runs.get(runId)?.edges.get(event.edgeId),
        status: "taken",
        takenAt: event.at,
      });

    default:
      console.warn(`applyEvent: unknown event type "${(event as { type: string }).type}"`);
      return runs;
  }
}

// ─── Slice ───────────────────────────────────────────────────────────

export type ExecutionStatus = "idle" | "running" | "paused" | "completed" | "failed";

/** Options for `startRun`. */
export interface StartRunOptions {
  /** When true, prior runs are retained instead of cleared. Default: false. */
  readonly retainPriorRuns?: boolean;
}

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
  /** Apply an execution event to the runs state. */
  applyExecutionEvent: (event: ExecutionEvent) => void;
  /**
   * Start a new execution run. By default clears all prior runs.
   * Pass `{ retainPriorRuns: true }` to keep them.
   * Sets `activeRunId` to the new run.
   */
  startRun: (runId: string, options?: StartRunOptions) => void;
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
    applyExecutionEvent: (event: ExecutionEvent) => {
      const state = _get();
      const nextRuns = applyEvent(state.runs, event);
      if (nextRuns !== state.runs) {
        set({ runs: nextRuns });
      }
    },
    startRun: (runId: string, options?: StartRunOptions) => {
      const state = _get();
      const base = options?.retainPriorRuns ? new Map(state.runs) : new Map<string, RunState>();
      const newRun: RunState = {
        nodes: new Map(),
        edges: new Map(),
        status: "running",
        startedAt: Date.now(),
      };
      base.set(runId, newRun);
      set({ runs: base, activeRunId: runId });
    },
  };
}
