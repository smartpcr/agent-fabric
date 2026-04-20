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
export type EdgeExecutionStatus =
  | "idle"
  | "active"
  | "taken"
  | "succeeded"
  | "failed"
  | "not-taken";

/** Per-edge execution state within a run. */
export interface EdgeExecutionState {
  readonly status: EdgeExecutionStatus;
  readonly activatedAt?: number;
  readonly takenAt?: number;
  readonly iteration?: number;
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

// ─── Transition guard tables ─────────────────────────────────────────

/**
 * Legal node status transitions. Maps current status → set of allowed next statuses.
 * If a node has no entry (undefined / not in the map), it's treated as "idle".
 */
export const LEGAL_NODE_TRANSITIONS: Record<
  NodeExecutionStatus,
  ReadonlySet<NodeExecutionStatus>
> = {
  idle: new Set(["running", "skipped"]),
  running: new Set(["succeeded", "failed", "skipped"]),
  succeeded: new Set(["running"]), // re-run (loop iteration)
  failed: new Set(["running"]), // retry
  skipped: new Set(["running"]), // re-evaluation
};

/**
 * Legal edge status transitions. Maps current status → set of allowed next statuses.
 */
export const LEGAL_EDGE_TRANSITIONS: Record<
  EdgeExecutionStatus,
  ReadonlySet<EdgeExecutionStatus>
> = {
  idle: new Set(["active"]),
  active: new Set(["taken", "idle"]), // idle = deactivated
  taken: new Set(["active", "idle"]), // re-activation on next iteration
};

/**
 * Legal run status transitions.
 */
export const LEGAL_RUN_TRANSITIONS: Record<RunStatus, ReadonlySet<RunStatus>> = {
  running: new Set(["completed", "failed", "cancelled"]),
  completed: new Set(["running"]), // re-run
  failed: new Set(["running"]), // retry
  cancelled: new Set(["running"]), // restart
};

/**
 * Check whether a node transition is illegal. If so, logs a warning and returns true.
 * Returns false if the transition is legal.
 */
function isIllegalNodeTransition(
  runs: Map<string, RunState>,
  runId: string,
  nodeId: string,
  target: NodeExecutionStatus,
): boolean {
  const current = runs.get(runId)?.nodes.get(nodeId)?.status ?? "idle";
  if (LEGAL_NODE_TRANSITIONS[current].has(target)) {
    return false;
  }
  console.warn(`applyEvent: illegal node transition for "${nodeId}": "${current}" → "${target}"`);
  return true;
}

/**
 * Check whether an edge transition is illegal. If so, logs a warning and returns true.
 * Returns false if the transition is legal.
 */
function isIllegalEdgeTransition(
  runs: Map<string, RunState>,
  runId: string,
  edgeId: string,
  target: EdgeExecutionStatus,
): boolean {
  const current = runs.get(runId)?.edges.get(edgeId)?.status ?? "idle";
  if (LEGAL_EDGE_TRANSITIONS[current].has(target)) {
    return false;
  }
  console.warn(`applyEvent: illegal edge transition for "${edgeId}": "${current}" → "${target}"`);
  return true;
}

/**
 * Check whether a run status transition is illegal. If so, logs a warning and returns true.
 * Returns false if the transition is legal.
 */
function isIllegalRunTransition(
  runs: Map<string, RunState>,
  runId: string,
  target: RunStatus,
): boolean {
  const run = runs.get(runId);
  if (run && LEGAL_RUN_TRANSITIONS[run.status].has(target)) {
    return false;
  }
  console.warn(
    `applyEvent: illegal run transition for "${runId}": "${run?.status ?? "missing"}" → "${target}"`,
  );
  return true;
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

// ─── Per-category event handlers ─────────────────────────────────────

function applyRunEvent(
  runs: Map<string, RunState>,
  event: ExecutionEvent,
): Map<string, RunState> | undefined {
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
      if (isIllegalRunTransition(runs, runId, "completed")) return runs;
      return finalizeRun(runs, runId, "completed", event.at);
    case "run.failed":
      if (isIllegalRunTransition(runs, runId, "failed")) return runs;
      return finalizeRun(runs, runId, "failed", event.at);
    case "run.cancelled":
      if (isIllegalRunTransition(runs, runId, "cancelled")) return runs;
      return finalizeRun(runs, runId, "cancelled", event.at);
    default:
      return undefined;
  }
}

function applyNodeEvent(
  runs: Map<string, RunState>,
  event: ExecutionEvent,
): Map<string, RunState> | undefined {
  const { runId } = event;

  switch (event.type) {
    case "node.started":
      if (isIllegalNodeTransition(runs, runId, event.nodeId, "running")) return runs;
      return updateNodeInRun(runs, runId, event.nodeId, {
        status: "running",
        startedAt: event.at,
        iteration: event.payload?.iteration,
      });
    case "node.succeeded":
      if (isIllegalNodeTransition(runs, runId, event.nodeId, "succeeded")) return runs;
      return updateNodeInRun(runs, runId, event.nodeId, {
        ...runs.get(runId)?.nodes.get(event.nodeId),
        status: "succeeded",
        finishedAt: event.at,
      });
    case "node.failed":
      if (isIllegalNodeTransition(runs, runId, event.nodeId, "failed")) return runs;
      return updateNodeInRun(runs, runId, event.nodeId, {
        ...runs.get(runId)?.nodes.get(event.nodeId),
        status: "failed",
        finishedAt: event.at,
        error: event.payload?.error,
      });
    case "node.skipped":
      if (isIllegalNodeTransition(runs, runId, event.nodeId, "skipped")) return runs;
      return updateNodeInRun(runs, runId, event.nodeId, { status: "skipped" });
    default:
      return undefined;
  }
}

function applyEdgeEvent(
  runs: Map<string, RunState>,
  event: ExecutionEvent,
): Map<string, RunState> | undefined {
  const { runId } = event;

  switch (event.type) {
    case "edge.activated":
      if (isIllegalEdgeTransition(runs, runId, event.edgeId, "active")) return runs;
      return updateEdgeInRun(runs, runId, event.edgeId, {
        status: "active",
        activatedAt: event.at,
      });
    case "edge.taken":
      if (isIllegalEdgeTransition(runs, runId, event.edgeId, "taken")) return runs;
      return updateEdgeInRun(runs, runId, event.edgeId, {
        ...runs.get(runId)?.edges.get(event.edgeId),
        status: "taken",
        takenAt: event.at,
      });
    default:
      return undefined;
  }
}

// ─── applyEvent pure reducer ─────────────────────────────────────────

/**
 * Pure reducer: given a runs map and an execution event, returns a new runs
 * map with the event applied. Creates a run entry on `run.started`. Sets
 * `finishedAt` on terminal run events (`run.completed`, `run.failed`,
 * `run.cancelled`). Updates node/edge maps based on event type.
 *
 * Illegal transitions are dropped with a `console.warn`.
 * Unknown event types log a warning and return the state unchanged.
 */
export function applyEvent(
  runs: Map<string, RunState>,
  event: ExecutionEvent,
): Map<string, RunState> {
  const result =
    applyRunEvent(runs, event) ?? applyNodeEvent(runs, event) ?? applyEdgeEvent(runs, event);

  if (result !== undefined) {
    return result;
  }

  console.warn(`applyEvent: unknown event type "${(event as { type: string }).type}"`);
  return runs;
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
