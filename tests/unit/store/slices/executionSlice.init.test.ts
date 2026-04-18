import { describe, it, expect, beforeEach } from "vitest";
import { createStore, type WorkflowState } from "@/store/createStore";
import type { StoreApi } from "zustand";
import type { RunState } from "@/store/slices/executionSlice";

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

// ─── Tests ───────────────────────────────────────────────────────────

describe("executionSlice — state shape & init", () => {
  let store: StoreApi<WorkflowState>;

  beforeEach(() => {
    store = createStore();
  });

  describe("initial state", () => {
    it("starts with an empty runs map", () => {
      const { runs } = store.getState();
      expect(runs).toBeInstanceOf(Map);
      expect(runs.size).toBe(0);
    });

    it("starts with activeRunId undefined", () => {
      expect(store.getState().activeRunId).toBeUndefined();
    });

    it("preserves legacy executionStatus as idle", () => {
      expect(store.getState().executionStatus).toBe("idle");
    });

    it("preserves legacy executionLog as empty", () => {
      expect(store.getState().executionLog).toEqual([]);
    });
  });

  describe("setActiveRun", () => {
    it("sets activeRunId to the given runId", () => {
      store.getState().setActiveRun("run-1");
      expect(store.getState().activeRunId).toBe("run-1");
    });

    it("overwrites a previous activeRunId", () => {
      store.getState().setActiveRun("run-1");
      store.getState().setActiveRun("run-2");
      expect(store.getState().activeRunId).toBe("run-2");
    });

    it("can set activeRunId to a runId that does not exist in runs", () => {
      store.getState().setActiveRun("nonexistent");
      expect(store.getState().activeRunId).toBe("nonexistent");
    });
  });

  describe("clearRun", () => {
    it("removes the specified run from the runs map", () => {
      const run = makeRun();
      store.setState({ runs: new Map([["run-1", run]]) });

      store.getState().clearRun("run-1");

      expect(store.getState().runs.has("run-1")).toBe(false);
      expect(store.getState().runs.size).toBe(0);
    });

    it("clears activeRunId if it matches the cleared run", () => {
      const run = makeRun();
      store.setState({
        runs: new Map([["run-1", run]]),
        activeRunId: "run-1",
      });

      store.getState().clearRun("run-1");

      expect(store.getState().activeRunId).toBeUndefined();
    });

    it("preserves activeRunId if it does not match the cleared run", () => {
      const run1 = makeRun();
      const run2 = makeRun();
      store.setState({
        runs: new Map([
          ["run-1", run1],
          ["run-2", run2],
        ]),
        activeRunId: "run-2",
      });

      store.getState().clearRun("run-1");

      expect(store.getState().activeRunId).toBe("run-2");
      expect(store.getState().runs.has("run-1")).toBe(false);
      expect(store.getState().runs.has("run-2")).toBe(true);
    });

    it("is a no-op when the runId does not exist", () => {
      const run = makeRun();
      store.setState({
        runs: new Map([["run-1", run]]),
        activeRunId: "run-1",
      });

      store.getState().clearRun("nonexistent");

      expect(store.getState().runs.size).toBe(1);
      expect(store.getState().activeRunId).toBe("run-1");
    });

    it("does not affect other runs when clearing one", () => {
      const run1 = makeRun({ status: "running" });
      const run2 = makeRun({ status: "completed" });
      const run3 = makeRun({ status: "failed" });
      store.setState({
        runs: new Map([
          ["run-1", run1],
          ["run-2", run2],
          ["run-3", run3],
        ]),
      });

      store.getState().clearRun("run-2");

      expect(store.getState().runs.size).toBe(2);
      expect(store.getState().runs.get("run-1")).toBe(run1);
      expect(store.getState().runs.get("run-3")).toBe(run3);
    });
  });

  describe("RunState shape", () => {
    it("holds nodes and edges as Maps", () => {
      const run = makeRun({
        nodes: new Map([
          ["node-1", { status: "running", startedAt: 1000 }],
          ["node-2", { status: "idle" }],
        ]),
        edges: new Map([["edge-1", { status: "active", activatedAt: 1000 }]]),
      });
      store.setState({ runs: new Map([["run-1", run]]) });

      const stored = store.getState().runs.get("run-1");
      expect(stored).toBeDefined();
      expect(stored?.nodes).toBeInstanceOf(Map);
      expect(stored?.edges).toBeInstanceOf(Map);
      expect(stored?.nodes.size).toBe(2);
      expect(stored?.edges.size).toBe(1);
    });

    it("includes status, startedAt, and optional finishedAt", () => {
      const run = makeRun({
        status: "completed",
        startedAt: 1000,
        finishedAt: 2000,
      });
      store.setState({ runs: new Map([["run-1", run]]) });

      const stored = store.getState().runs.get("run-1");
      expect(stored?.status).toBe("completed");
      expect(stored?.startedAt).toBe(1000);
      expect(stored?.finishedAt).toBe(2000);
    });

    it("finishedAt is optional (undefined for running)", () => {
      const run = makeRun({ status: "running" });
      store.setState({ runs: new Map([["run-1", run]]) });

      const stored = store.getState().runs.get("run-1");
      expect(stored?.finishedAt).toBeUndefined();
    });
  });

  describe("legacy actions still work", () => {
    it("startExecution sets executionStatus to running", () => {
      store.getState().startExecution();
      expect(store.getState().executionStatus).toBe("running");
    });

    it("stopExecution resets executionStatus and log", () => {
      store.getState().startExecution();
      store.getState().stopExecution();
      expect(store.getState().executionStatus).toBe("idle");
      expect(store.getState().executionLog).toEqual([]);
    });
  });
});
