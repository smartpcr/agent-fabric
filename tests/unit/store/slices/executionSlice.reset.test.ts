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

function seedRun(store: StoreApi<WorkflowState>, runId: string, run: RunState): void {
  const state = store.getState();
  const next = new Map(state.runs);
  next.set(runId, run);
  store.setState({ runs: next });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("executionSlice — startRun / reset", () => {
  let store: StoreApi<WorkflowState>;

  beforeEach(() => {
    store = createStore();
  });

  // ── Default behavior (clears prior runs) ──────────────────────

  describe("default behavior — clears prior runs", () => {
    it("creates a new run with status running", () => {
      store.getState().startRun("run-1");

      const run = store.getState().runs.get("run-1");
      expect(run).toBeDefined();
      expect(run?.status).toBe("running");
      expect(run?.nodes).toBeInstanceOf(Map);
      expect(run?.nodes.size).toBe(0);
      expect(run?.edges).toBeInstanceOf(Map);
      expect(run?.edges.size).toBe(0);
      expect(run?.startedAt).toBeGreaterThan(0);
    });

    it("sets activeRunId to the new run", () => {
      store.getState().startRun("run-1");
      expect(store.getState().activeRunId).toBe("run-1");
    });

    it("clears all prior runs", () => {
      seedRun(store, "old-run-a", makeRun());
      seedRun(store, "old-run-b", makeRun());
      expect(store.getState().runs.size).toBe(2);

      store.getState().startRun("new-run");

      const { runs } = store.getState();
      expect(runs.size).toBe(1);
      expect(runs.has("old-run-a")).toBe(false);
      expect(runs.has("old-run-b")).toBe(false);
      expect(runs.has("new-run")).toBe(true);
    });

    it("replaces activeRunId from a prior run", () => {
      store.getState().startRun("run-1");
      expect(store.getState().activeRunId).toBe("run-1");

      store.getState().startRun("run-2");
      expect(store.getState().activeRunId).toBe("run-2");
      expect(store.getState().runs.has("run-1")).toBe(false);
    });
  });

  // ── Retention flag ────────────────────────────────────────────

  describe("retainPriorRuns flag", () => {
    it("preserves prior runs when retainPriorRuns is true", () => {
      seedRun(store, "old-run", makeRun());
      store.getState().startRun("new-run", { retainPriorRuns: true });

      const { runs } = store.getState();
      expect(runs.size).toBe(2);
      expect(runs.has("old-run")).toBe(true);
      expect(runs.has("new-run")).toBe(true);
    });

    it("sets activeRunId to the new run even when retaining", () => {
      seedRun(store, "old-run", makeRun());
      store.setState({ activeRunId: "old-run" });

      store.getState().startRun("new-run", { retainPriorRuns: true });
      expect(store.getState().activeRunId).toBe("new-run");
    });

    it("does not modify prior run data", () => {
      const nodeState = { status: "succeeded" as const, startedAt: 100, finishedAt: 200 };
      seedRun(
        store,
        "old-run",
        makeRun({
          status: "completed",
          nodes: new Map([["n1", nodeState]]),
          finishedAt: 500,
        }),
      );

      store.getState().startRun("new-run", { retainPriorRuns: true });

      const oldRun = store.getState().runs.get("old-run");
      expect(oldRun?.status).toBe("completed");
      expect(oldRun?.nodes.get("n1")?.status).toBe("succeeded");
      expect(oldRun?.finishedAt).toBe(500);
    });

    it("clears prior runs when retainPriorRuns is false", () => {
      seedRun(store, "old-run", makeRun());
      store.getState().startRun("new-run", { retainPriorRuns: false });

      const { runs } = store.getState();
      expect(runs.size).toBe(1);
      expect(runs.has("old-run")).toBe(false);
      expect(runs.has("new-run")).toBe(true);
    });

    it("clears prior runs when retainPriorRuns is undefined", () => {
      seedRun(store, "old-run", makeRun());
      store.getState().startRun("new-run", {});

      const { runs } = store.getState();
      expect(runs.size).toBe(1);
      expect(runs.has("old-run")).toBe(false);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────

  describe("edge cases", () => {
    it("startRun with same runId overwrites the existing run", () => {
      store.getState().startRun("run-1");
      const firstStart = store.getState().runs.get("run-1")?.startedAt;

      // Small delay to ensure different timestamp
      store.getState().startRun("run-1");
      const run = store.getState().runs.get("run-1");
      expect(run?.status).toBe("running");
      expect(run?.nodes.size).toBe(0);
      // startedAt may differ or equal depending on timing, but run is fresh
      expect(run?.startedAt).toBeGreaterThanOrEqual(firstStart ?? 0);
    });

    it("works from a completely empty store", () => {
      expect(store.getState().runs.size).toBe(0);
      expect(store.getState().activeRunId).toBeUndefined();

      store.getState().startRun("first");

      expect(store.getState().runs.size).toBe(1);
      expect(store.getState().activeRunId).toBe("first");
    });

    it("retainPriorRuns with empty store just creates the new run", () => {
      store.getState().startRun("run-1", { retainPriorRuns: true });

      expect(store.getState().runs.size).toBe(1);
      expect(store.getState().runs.has("run-1")).toBe(true);
    });
  });
});
