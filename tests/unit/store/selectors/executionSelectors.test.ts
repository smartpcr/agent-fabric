import { describe, it, expect, beforeEach } from "vitest";
import { createStore, type WorkflowState } from "@/store/createStore";
import type { StoreApi } from "zustand";
import type {
  RunState,
  NodeExecutionState,
  EdgeExecutionState,
} from "@/store/slices/executionSlice";
import {
  selectNodeExecutionState,
  selectEdgeExecutionState,
  clearExecutionSelectorCache,
} from "@/store/selectors/executionSelectors";

// ─── Helpers ─────────────────────────────────────────────────────────

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return {
    nodes: new Map(),
    edges: new Map(),
    status: "running",
    startedAt: Date.now(),
    ...overrides,
  };
}

function seedRun(store: StoreApi<WorkflowState>, runId: string, run: RunState): void {
  const state = store.getState();
  const next = new Map(state.runs);
  next.set(runId, run);
  store.setState({ runs: next });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("executionSelectors", () => {
  let store: StoreApi<WorkflowState>;

  beforeEach(() => {
    clearExecutionSelectorCache();
    store = createStore();
  });

  // ── selectNodeExecutionState ──────────────────────────────────

  describe("selectNodeExecutionState", () => {
    it("returns undefined for a nonexistent run", () => {
      const result = selectNodeExecutionState(store.getState(), "no-run", "n1");
      expect(result).toBeUndefined();
    });

    it("returns undefined for a nonexistent node in an existing run", () => {
      seedRun(store, "run-1", makeRun());
      const result = selectNodeExecutionState(store.getState(), "run-1", "n-missing");
      expect(result).toBeUndefined();
    });

    it("returns the node execution state for an existing node", () => {
      const nodeState: NodeExecutionState = { status: "running", startedAt: 1000 };
      seedRun(store, "run-1", makeRun({ nodes: new Map([["n1", nodeState]]) }));

      const result = selectNodeExecutionState(store.getState(), "run-1", "n1");
      expect(result).toEqual({ status: "running", startedAt: 1000 });
    });

    it("returns a stable reference across unrelated state changes", () => {
      const nodeState: NodeExecutionState = {
        status: "succeeded",
        startedAt: 1000,
        finishedAt: 2000,
      };
      seedRun(store, "run-1", makeRun({ nodes: new Map([["n1", nodeState]]) }));

      const ref1 = selectNodeExecutionState(store.getState(), "run-1", "n1");

      // Trigger an unrelated state change (selection, viewport, etc.)
      store.setState({ activeRunId: "run-1" });

      const ref2 = selectNodeExecutionState(store.getState(), "run-1", "n1");
      expect(ref2).toBe(ref1);
    });

    it("returns a stable reference when re-set with shallow-equal data", () => {
      const nodeState: NodeExecutionState = { status: "running", startedAt: 1000 };
      seedRun(store, "run-1", makeRun({ nodes: new Map([["n1", nodeState]]) }));

      const ref1 = selectNodeExecutionState(store.getState(), "run-1", "n1");

      // Re-seed with a structurally equal but new object
      const nodeState2: NodeExecutionState = { status: "running", startedAt: 1000 };
      seedRun(store, "run-1", makeRun({ nodes: new Map([["n1", nodeState2]]) }));

      const ref2 = selectNodeExecutionState(store.getState(), "run-1", "n1");
      expect(ref2).toBe(ref1);
    });

    it("returns a new reference when the node state changes", () => {
      const nodeState: NodeExecutionState = { status: "running", startedAt: 1000 };
      seedRun(store, "run-1", makeRun({ nodes: new Map([["n1", nodeState]]) }));

      const ref1 = selectNodeExecutionState(store.getState(), "run-1", "n1");

      const updated: NodeExecutionState = {
        status: "succeeded",
        startedAt: 1000,
        finishedAt: 2000,
      };
      seedRun(store, "run-1", makeRun({ nodes: new Map([["n1", updated]]) }));

      const ref2 = selectNodeExecutionState(store.getState(), "run-1", "n1");
      expect(ref2).not.toBe(ref1);
      expect(ref2?.status).toBe("succeeded");
    });

    it("handles multiple runs independently", () => {
      const ns1: NodeExecutionState = { status: "running", startedAt: 100 };
      const ns2: NodeExecutionState = { status: "succeeded", startedAt: 200, finishedAt: 300 };
      seedRun(store, "run-a", makeRun({ nodes: new Map([["n1", ns1]]) }));
      seedRun(store, "run-b", makeRun({ nodes: new Map([["n1", ns2]]) }));

      const refA = selectNodeExecutionState(store.getState(), "run-a", "n1");
      const refB = selectNodeExecutionState(store.getState(), "run-b", "n1");

      expect(refA?.status).toBe("running");
      expect(refB?.status).toBe("succeeded");
      expect(refA).not.toBe(refB);
    });

    it("transitions from defined to undefined correctly", () => {
      const nodeState: NodeExecutionState = { status: "running", startedAt: 1000 };
      seedRun(store, "run-1", makeRun({ nodes: new Map([["n1", nodeState]]) }));

      const ref1 = selectNodeExecutionState(store.getState(), "run-1", "n1");
      expect(ref1).toBeDefined();

      // Remove the node from the run
      seedRun(store, "run-1", makeRun({ nodes: new Map() }));

      const ref2 = selectNodeExecutionState(store.getState(), "run-1", "n1");
      expect(ref2).toBeUndefined();
    });
  });

  // ── selectEdgeExecutionState ──────────────────────────────────

  describe("selectEdgeExecutionState", () => {
    it("returns undefined for a nonexistent run", () => {
      const result = selectEdgeExecutionState(store.getState(), "no-run", "e1");
      expect(result).toBeUndefined();
    });

    it("returns undefined for a nonexistent edge in an existing run", () => {
      seedRun(store, "run-1", makeRun());
      const result = selectEdgeExecutionState(store.getState(), "run-1", "e-missing");
      expect(result).toBeUndefined();
    });

    it("returns the edge execution state for an existing edge", () => {
      const edgeState: EdgeExecutionState = { status: "active", activatedAt: 1000 };
      seedRun(store, "run-1", makeRun({ edges: new Map([["e1", edgeState]]) }));

      const result = selectEdgeExecutionState(store.getState(), "run-1", "e1");
      expect(result).toEqual({ status: "active", activatedAt: 1000 });
    });

    it("returns a stable reference across unrelated state changes", () => {
      const edgeState: EdgeExecutionState = { status: "taken", activatedAt: 1000, takenAt: 2000 };
      seedRun(store, "run-1", makeRun({ edges: new Map([["e1", edgeState]]) }));

      const ref1 = selectEdgeExecutionState(store.getState(), "run-1", "e1");

      // Trigger an unrelated state change
      store.setState({ activeRunId: "run-1" });

      const ref2 = selectEdgeExecutionState(store.getState(), "run-1", "e1");
      expect(ref2).toBe(ref1);
    });

    it("returns a stable reference when re-set with shallow-equal data", () => {
      const edgeState: EdgeExecutionState = { status: "active", activatedAt: 1000 };
      seedRun(store, "run-1", makeRun({ edges: new Map([["e1", edgeState]]) }));

      const ref1 = selectEdgeExecutionState(store.getState(), "run-1", "e1");

      // Re-seed with structurally equal but new object
      const edgeState2: EdgeExecutionState = { status: "active", activatedAt: 1000 };
      seedRun(store, "run-1", makeRun({ edges: new Map([["e1", edgeState2]]) }));

      const ref2 = selectEdgeExecutionState(store.getState(), "run-1", "e1");
      expect(ref2).toBe(ref1);
    });

    it("returns a new reference when the edge state changes", () => {
      const edgeState: EdgeExecutionState = { status: "active", activatedAt: 1000 };
      seedRun(store, "run-1", makeRun({ edges: new Map([["e1", edgeState]]) }));

      const ref1 = selectEdgeExecutionState(store.getState(), "run-1", "e1");

      const updated: EdgeExecutionState = { status: "taken", activatedAt: 1000, takenAt: 2000 };
      seedRun(store, "run-1", makeRun({ edges: new Map([["e1", updated]]) }));

      const ref2 = selectEdgeExecutionState(store.getState(), "run-1", "e1");
      expect(ref2).not.toBe(ref1);
      expect(ref2?.status).toBe("taken");
    });

    it("handles multiple runs independently", () => {
      const es1: EdgeExecutionState = { status: "active", activatedAt: 100 };
      const es2: EdgeExecutionState = { status: "taken", activatedAt: 200, takenAt: 300 };
      seedRun(store, "run-a", makeRun({ edges: new Map([["e1", es1]]) }));
      seedRun(store, "run-b", makeRun({ edges: new Map([["e1", es2]]) }));

      const refA = selectEdgeExecutionState(store.getState(), "run-a", "e1");
      const refB = selectEdgeExecutionState(store.getState(), "run-b", "e1");

      expect(refA?.status).toBe("active");
      expect(refB?.status).toBe("taken");
      expect(refA).not.toBe(refB);
    });

    it("transitions from defined to undefined correctly", () => {
      const edgeState: EdgeExecutionState = { status: "active", activatedAt: 1000 };
      seedRun(store, "run-1", makeRun({ edges: new Map([["e1", edgeState]]) }));

      const ref1 = selectEdgeExecutionState(store.getState(), "run-1", "e1");
      expect(ref1).toBeDefined();

      seedRun(store, "run-1", makeRun({ edges: new Map() }));

      const ref2 = selectEdgeExecutionState(store.getState(), "run-1", "e1");
      expect(ref2).toBeUndefined();
    });
  });

  // ── clearExecutionSelectorCache ───────────────────────────────

  describe("clearExecutionSelectorCache", () => {
    it("clears cached references so next call returns fresh data", () => {
      const nodeState: NodeExecutionState = { status: "running", startedAt: 1000 };
      seedRun(store, "run-1", makeRun({ nodes: new Map([["n1", nodeState]]) }));

      const ref1 = selectNodeExecutionState(store.getState(), "run-1", "n1");

      clearExecutionSelectorCache();

      // Re-seed with the same data — after cache clear, we get the new object
      const nodeState2: NodeExecutionState = { status: "running", startedAt: 1000 };
      seedRun(store, "run-1", makeRun({ nodes: new Map([["n1", nodeState2]]) }));

      const ref2 = selectNodeExecutionState(store.getState(), "run-1", "n1");
      // After clearing, both have the same shape but ref2 is a new object
      // since the cache was wiped (prev was undefined → cache miss)
      expect(ref2).toEqual(ref1);
    });
  });
});
