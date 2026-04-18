import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyEvent, type RunState } from "@/store/slices/executionSlice";
import { createStore, type WorkflowState } from "@/store/createStore";
import type { StoreApi } from "zustand";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

// ─── Helpers ─────────────────────────────────────────────────────────

const NOW = 1000;

function emptyRuns(): Map<string, RunState> {
  return new Map();
}

function runsWithStarted(runId = "run-1", at = NOW): Map<string, RunState> {
  return new Map([
    [
      runId,
      {
        nodes: new Map(),
        edges: new Map(),
        status: "running" as const,
        startedAt: at,
        eventLog: [],
      },
    ],
  ]);
}

// ─── Pure applyEvent tests ───────────────────────────────────────────

describe("applyEvent — pure reducer", () => {
  // ── run.started ──────────────────────────────────────────────────

  describe("run.started", () => {
    it("creates a new run entry with running status and startedAt", () => {
      const event: ExecutionEvent = { type: "run.started", runId: "run-1", at: NOW };
      const result = applyEvent(emptyRuns(), event);

      expect(result.has("run-1")).toBe(true);
      const run = result.get("run-1");
      expect(run?.status).toBe("running");
      expect(run?.startedAt).toBe(NOW);
      expect(run?.finishedAt).toBeUndefined();
      expect(run?.nodes.size).toBe(0);
      expect(run?.edges.size).toBe(0);
    });

    it("overwrites an existing run with the same runId", () => {
      const runs = runsWithStarted("run-1", 500);
      const event: ExecutionEvent = { type: "run.started", runId: "run-1", at: NOW };
      const result = applyEvent(runs, event);

      expect(result.get("run-1")?.startedAt).toBe(NOW);
    });
  });

  // ── run.completed ────────────────────────────────────────────────

  describe("run.completed", () => {
    it("sets status to completed and finishedAt", () => {
      const runs = runsWithStarted();
      const event: ExecutionEvent = { type: "run.completed", runId: "run-1", at: 2000 };
      const result = applyEvent(runs, event);

      const run = result.get("run-1");
      expect(run?.status).toBe("completed");
      expect(run?.finishedAt).toBe(2000);
    });

    it("returns unchanged state if run does not exist", () => {
      const runs = emptyRuns();
      const event: ExecutionEvent = { type: "run.completed", runId: "run-1", at: 2000 };
      const result = applyEvent(runs, event);

      expect(result).toBe(runs);
    });
  });

  // ── run.failed ───────────────────────────────────────────────────

  describe("run.failed", () => {
    it("sets status to failed and finishedAt", () => {
      const runs = runsWithStarted();
      const event: ExecutionEvent = { type: "run.failed", runId: "run-1", at: 2000 };
      const result = applyEvent(runs, event);

      const run = result.get("run-1");
      expect(run?.status).toBe("failed");
      expect(run?.finishedAt).toBe(2000);
    });

    it("returns unchanged state if run does not exist", () => {
      const runs = emptyRuns();
      const event: ExecutionEvent = { type: "run.failed", runId: "run-1", at: 2000 };
      const result = applyEvent(runs, event);

      expect(result).toBe(runs);
    });
  });

  // ── run.cancelled ────────────────────────────────────────────────

  describe("run.cancelled", () => {
    it("sets status to cancelled and finishedAt", () => {
      const runs = runsWithStarted();
      const event: ExecutionEvent = { type: "run.cancelled", runId: "run-1", at: 2000 };
      const result = applyEvent(runs, event);

      const run = result.get("run-1");
      expect(run?.status).toBe("cancelled");
      expect(run?.finishedAt).toBe(2000);
    });

    it("returns unchanged state if run does not exist", () => {
      const runs = emptyRuns();
      const event: ExecutionEvent = { type: "run.cancelled", runId: "run-1", at: 2000 };
      const result = applyEvent(runs, event);

      expect(result).toBe(runs);
    });
  });

  // ── node.started ─────────────────────────────────────────────────

  describe("node.started", () => {
    it("sets node to running with startedAt", () => {
      const runs = runsWithStarted();
      const event: ExecutionEvent = {
        type: "node.started",
        runId: "run-1",
        at: 1100,
        nodeId: "node-1",
      };
      const result = applyEvent(runs, event);

      const node = result.get("run-1")?.nodes.get("node-1");
      expect(node?.status).toBe("running");
      expect(node?.startedAt).toBe(1100);
    });

    it("captures iteration from payload", () => {
      const runs = runsWithStarted();
      const event: ExecutionEvent = {
        type: "node.started",
        runId: "run-1",
        at: 1100,
        nodeId: "node-1",
        payload: { iteration: 3 },
      };
      const result = applyEvent(runs, event);

      expect(result.get("run-1")?.nodes.get("node-1")?.iteration).toBe(3);
    });

    it("returns unchanged state if run does not exist", () => {
      const runs = emptyRuns();
      const event: ExecutionEvent = {
        type: "node.started",
        runId: "run-1",
        at: 1100,
        nodeId: "node-1",
      };
      const result = applyEvent(runs, event);

      expect(result).toBe(runs);
    });
  });

  // ── node.succeeded ───────────────────────────────────────────────

  describe("node.succeeded", () => {
    it("sets node to succeeded with finishedAt", () => {
      const runs = runsWithStarted();
      // First start the node
      const r1 = applyEvent(runs, {
        type: "node.started",
        runId: "run-1",
        at: 1100,
        nodeId: "node-1",
      });
      const event: ExecutionEvent = {
        type: "node.succeeded",
        runId: "run-1",
        at: 1200,
        nodeId: "node-1",
      };
      const result = applyEvent(r1, event);

      const node = result.get("run-1")?.nodes.get("node-1");
      expect(node?.status).toBe("succeeded");
      expect(node?.finishedAt).toBe(1200);
      // Preserves startedAt from the started event
      expect(node?.startedAt).toBe(1100);
    });

    it("works even if node was not previously started", () => {
      const runs = runsWithStarted();
      const event: ExecutionEvent = {
        type: "node.succeeded",
        runId: "run-1",
        at: 1200,
        nodeId: "node-1",
      };
      const result = applyEvent(runs, event);

      const node = result.get("run-1")?.nodes.get("node-1");
      expect(node?.status).toBe("succeeded");
      expect(node?.finishedAt).toBe(1200);
    });

    it("returns unchanged state if run does not exist", () => {
      const runs = emptyRuns();
      const event: ExecutionEvent = {
        type: "node.succeeded",
        runId: "run-1",
        at: 1200,
        nodeId: "node-1",
      };
      expect(applyEvent(runs, event)).toBe(runs);
    });
  });

  // ── node.failed ──────────────────────────────────────────────────

  describe("node.failed", () => {
    it("sets node to failed with finishedAt and error", () => {
      const runs = runsWithStarted();
      const r1 = applyEvent(runs, {
        type: "node.started",
        runId: "run-1",
        at: 1100,
        nodeId: "node-1",
      });
      const event: ExecutionEvent = {
        type: "node.failed",
        runId: "run-1",
        at: 1200,
        nodeId: "node-1",
        payload: { error: "timeout" },
      };
      const result = applyEvent(r1, event);

      const node = result.get("run-1")?.nodes.get("node-1");
      expect(node?.status).toBe("failed");
      expect(node?.finishedAt).toBe(1200);
      expect(node?.error).toBe("timeout");
      expect(node?.startedAt).toBe(1100);
    });

    it("returns unchanged state if run does not exist", () => {
      const runs = emptyRuns();
      const event: ExecutionEvent = {
        type: "node.failed",
        runId: "run-1",
        at: 1200,
        nodeId: "node-1",
      };
      expect(applyEvent(runs, event)).toBe(runs);
    });
  });

  // ── node.skipped ─────────────────────────────────────────────────

  describe("node.skipped", () => {
    it("sets node to skipped", () => {
      const runs = runsWithStarted();
      const event: ExecutionEvent = {
        type: "node.skipped",
        runId: "run-1",
        at: 1100,
        nodeId: "node-1",
      };
      const result = applyEvent(runs, event);

      const node = result.get("run-1")?.nodes.get("node-1");
      expect(node?.status).toBe("skipped");
    });

    it("returns unchanged state if run does not exist", () => {
      const runs = emptyRuns();
      const event: ExecutionEvent = {
        type: "node.skipped",
        runId: "run-1",
        at: 1100,
        nodeId: "node-1",
      };
      expect(applyEvent(runs, event)).toBe(runs);
    });
  });

  // ── edge.activated ───────────────────────────────────────────────

  describe("edge.activated", () => {
    it("sets edge to active with activatedAt", () => {
      const runs = runsWithStarted();
      const event: ExecutionEvent = {
        type: "edge.activated",
        runId: "run-1",
        at: 1100,
        edgeId: "edge-1",
      };
      const result = applyEvent(runs, event);

      const edge = result.get("run-1")?.edges.get("edge-1");
      expect(edge?.status).toBe("active");
      expect(edge?.activatedAt).toBe(1100);
    });

    it("returns unchanged state if run does not exist", () => {
      const runs = emptyRuns();
      const event: ExecutionEvent = {
        type: "edge.activated",
        runId: "run-1",
        at: 1100,
        edgeId: "edge-1",
      };
      expect(applyEvent(runs, event)).toBe(runs);
    });
  });

  // ── edge.taken ───────────────────────────────────────────────────

  describe("edge.taken", () => {
    it("sets edge to taken with takenAt", () => {
      const runs = runsWithStarted();
      const r1 = applyEvent(runs, {
        type: "edge.activated",
        runId: "run-1",
        at: 1100,
        edgeId: "edge-1",
      });
      const event: ExecutionEvent = {
        type: "edge.taken",
        runId: "run-1",
        at: 1200,
        edgeId: "edge-1",
      };
      const result = applyEvent(r1, event);

      const edge = result.get("run-1")?.edges.get("edge-1");
      expect(edge?.status).toBe("taken");
      expect(edge?.takenAt).toBe(1200);
      // Preserves activatedAt from activation
      expect(edge?.activatedAt).toBe(1100);
    });

    it("returns unchanged state if run does not exist", () => {
      const runs = emptyRuns();
      const event: ExecutionEvent = {
        type: "edge.taken",
        runId: "run-1",
        at: 1200,
        edgeId: "edge-1",
      };
      expect(applyEvent(runs, event)).toBe(runs);
    });
  });

  // ── Unknown event type ───────────────────────────────────────────

  describe("unknown event type", () => {
    it("logs a warning and returns state unchanged", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* silent */
      });
      const runs = runsWithStarted();

      const unknownEvent = { type: "bogus.event", runId: "run-1", at: 1000 };
      const result = applyEvent(runs, unknownEvent as unknown as ExecutionEvent);

      expect(result).toBe(runs);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("bogus.event"));
      warnSpy.mockRestore();
    });
  });

  // ── Multiple events in sequence ──────────────────────────────────

  describe("event sequence", () => {
    it("processes a full run lifecycle", () => {
      let runs = emptyRuns();

      runs = applyEvent(runs, { type: "run.started", runId: "run-1", at: 1000 });
      runs = applyEvent(runs, {
        type: "node.started",
        runId: "run-1",
        at: 1010,
        nodeId: "n1",
      });
      runs = applyEvent(runs, {
        type: "edge.activated",
        runId: "run-1",
        at: 1020,
        edgeId: "e1",
      });
      runs = applyEvent(runs, {
        type: "node.succeeded",
        runId: "run-1",
        at: 1030,
        nodeId: "n1",
      });
      runs = applyEvent(runs, {
        type: "edge.taken",
        runId: "run-1",
        at: 1040,
        edgeId: "e1",
      });
      runs = applyEvent(runs, { type: "run.completed", runId: "run-1", at: 1050 });

      const run = runs.get("run-1");
      expect(run?.status).toBe("completed");
      expect(run?.finishedAt).toBe(1050);
      expect(run?.nodes.get("n1")?.status).toBe("succeeded");
      expect(run?.edges.get("e1")?.status).toBe("taken");
    });

    it("handles multiple runs concurrently", () => {
      let runs = emptyRuns();

      runs = applyEvent(runs, { type: "run.started", runId: "run-1", at: 1000 });
      runs = applyEvent(runs, { type: "run.started", runId: "run-2", at: 1001 });

      runs = applyEvent(runs, {
        type: "node.started",
        runId: "run-1",
        at: 1010,
        nodeId: "n1",
      });
      runs = applyEvent(runs, {
        type: "node.started",
        runId: "run-2",
        at: 1011,
        nodeId: "n1",
      });

      expect(runs.size).toBe(2);
      expect(runs.get("run-1")?.nodes.get("n1")?.startedAt).toBe(1010);
      expect(runs.get("run-2")?.nodes.get("n1")?.startedAt).toBe(1011);
    });
  });
});

// ─── Store integration: applyExecutionEvent action ───────────────────

describe("applyExecutionEvent — store action", () => {
  let store: StoreApi<WorkflowState>;

  beforeEach(() => {
    store = createStore();
  });

  it("applies run.started via the store action", () => {
    store.getState().applyExecutionEvent({
      type: "run.started",
      runId: "run-1",
      at: NOW,
    });

    expect(store.getState().runs.has("run-1")).toBe(true);
    expect(store.getState().runs.get("run-1")?.status).toBe("running");
  });

  it("applies a sequence of events via the store action", () => {
    const { applyExecutionEvent } = store.getState();

    applyExecutionEvent({ type: "run.started", runId: "run-1", at: 1000 });
    // Re-read action to get updated closure
    store.getState().applyExecutionEvent({
      type: "node.started",
      runId: "run-1",
      at: 1010,
      nodeId: "n1",
    });
    store.getState().applyExecutionEvent({
      type: "node.succeeded",
      runId: "run-1",
      at: 1020,
      nodeId: "n1",
    });
    store.getState().applyExecutionEvent({
      type: "run.completed",
      runId: "run-1",
      at: 1030,
    });

    const run = store.getState().runs.get("run-1");
    expect(run?.status).toBe("completed");
    expect(run?.finishedAt).toBe(1030);
    expect(run?.nodes.get("n1")?.status).toBe("succeeded");
  });

  it("does not update store when runs reference is unchanged", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      /* silent */
    });

    const runsBefore = store.getState().runs;
    store.getState().applyExecutionEvent({
      type: "run.completed",
      runId: "nonexistent",
      at: 1000,
    });
    const runsAfter = store.getState().runs;

    expect(runsAfter).toBe(runsBefore);
    warnSpy.mockRestore();
  });
});
