import { describe, it, expect, vi, afterEach } from "vitest";
import {
  applyEvent,
  LEGAL_NODE_TRANSITIONS,
  LEGAL_EDGE_TRANSITIONS,
  LEGAL_RUN_TRANSITIONS,
  type RunState,
  type NodeExecutionStatus,
  type EdgeExecutionStatus,
  type RunStatus,
} from "@/store/slices/executionSlice";
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
      },
    ],
  ]);
}

function runsWithNodeState(
  nodeId: string,
  status: NodeExecutionStatus,
  runId = "run-1",
): Map<string, RunState> {
  return new Map([
    [
      runId,
      {
        nodes: new Map([[nodeId, { status, startedAt: NOW }]]),
        edges: new Map(),
        status: "running" as const,
        startedAt: NOW,
      },
    ],
  ]);
}

function runsWithEdgeState(
  edgeId: string,
  status: EdgeExecutionStatus,
  runId = "run-1",
): Map<string, RunState> {
  return new Map([
    [
      runId,
      {
        nodes: new Map(),
        edges: new Map([[edgeId, { status, activatedAt: NOW }]]),
        status: "running" as const,
        startedAt: NOW,
      },
    ],
  ]);
}

function runsWithRunStatus(status: RunStatus, runId = "run-1"): Map<string, RunState> {
  return new Map([
    [
      runId,
      {
        nodes: new Map(),
        edges: new Map(),
        status,
        startedAt: NOW,
        finishedAt: status === "running" ? undefined : NOW + 100,
      },
    ],
  ]);
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("transition guards", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Transition table export checks ─────────────────────────────

  describe("transition table exports", () => {
    it("exports LEGAL_NODE_TRANSITIONS with all statuses", () => {
      const statuses: NodeExecutionStatus[] = ["idle", "running", "succeeded", "failed", "skipped"];
      for (const s of statuses) {
        expect(LEGAL_NODE_TRANSITIONS[s]).toBeInstanceOf(Set);
      }
    });

    it("exports LEGAL_EDGE_TRANSITIONS with all statuses", () => {
      const statuses: EdgeExecutionStatus[] = ["idle", "active", "taken"];
      for (const s of statuses) {
        expect(LEGAL_EDGE_TRANSITIONS[s]).toBeInstanceOf(Set);
      }
    });

    it("exports LEGAL_RUN_TRANSITIONS with all statuses", () => {
      const statuses: RunStatus[] = ["running", "completed", "failed", "cancelled"];
      for (const s of statuses) {
        expect(LEGAL_RUN_TRANSITIONS[s]).toBeInstanceOf(Set);
      }
    });
  });

  // ── Node transition guards ─────────────────────────────────────

  describe("node transition guards", () => {
    describe("legal transitions", () => {
      it("idle → running (node.started)", () => {
        const runs = runsWithStarted();
        const result = applyEvent(runs, {
          type: "node.started",
          runId: "run-1",
          at: 1100,
          nodeId: "n1",
        });
        expect(result.get("run-1")?.nodes.get("n1")?.status).toBe("running");
      });

      it("idle → skipped (node.skipped)", () => {
        const runs = runsWithStarted();
        const result = applyEvent(runs, {
          type: "node.skipped",
          runId: "run-1",
          at: 1100,
          nodeId: "n1",
        });
        expect(result.get("run-1")?.nodes.get("n1")?.status).toBe("skipped");
      });

      it("running → succeeded (node.succeeded)", () => {
        const runs = runsWithNodeState("n1", "running");
        const result = applyEvent(runs, {
          type: "node.succeeded",
          runId: "run-1",
          at: 1200,
          nodeId: "n1",
        });
        expect(result.get("run-1")?.nodes.get("n1")?.status).toBe("succeeded");
      });

      it("running → failed (node.failed)", () => {
        const runs = runsWithNodeState("n1", "running");
        const result = applyEvent(runs, {
          type: "node.failed",
          runId: "run-1",
          at: 1200,
          nodeId: "n1",
        });
        expect(result.get("run-1")?.nodes.get("n1")?.status).toBe("failed");
      });

      it("running → skipped (node.skipped)", () => {
        const runs = runsWithNodeState("n1", "running");
        const result = applyEvent(runs, {
          type: "node.skipped",
          runId: "run-1",
          at: 1200,
          nodeId: "n1",
        });
        expect(result.get("run-1")?.nodes.get("n1")?.status).toBe("skipped");
      });

      it("succeeded → running (re-run / loop iteration)", () => {
        const runs = runsWithNodeState("n1", "succeeded");
        const result = applyEvent(runs, {
          type: "node.started",
          runId: "run-1",
          at: 1300,
          nodeId: "n1",
        });
        expect(result.get("run-1")?.nodes.get("n1")?.status).toBe("running");
      });

      it("failed → running (retry)", () => {
        const runs = runsWithNodeState("n1", "failed");
        const result = applyEvent(runs, {
          type: "node.started",
          runId: "run-1",
          at: 1300,
          nodeId: "n1",
        });
        expect(result.get("run-1")?.nodes.get("n1")?.status).toBe("running");
      });

      it("skipped → running (re-evaluation)", () => {
        const runs = runsWithNodeState("n1", "skipped");
        const result = applyEvent(runs, {
          type: "node.started",
          runId: "run-1",
          at: 1300,
          nodeId: "n1",
        });
        expect(result.get("run-1")?.nodes.get("n1")?.status).toBe("running");
      });
    });

    describe("illegal transitions — dropped with warning", () => {
      it("idle → succeeded (no started)", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithStarted();
        const result = applyEvent(runs, {
          type: "node.succeeded",
          runId: "run-1",
          at: 1200,
          nodeId: "n1",
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("illegal node transition"));
      });

      it("idle → failed (no started)", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithStarted();
        const result = applyEvent(runs, {
          type: "node.failed",
          runId: "run-1",
          at: 1200,
          nodeId: "n1",
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("illegal node transition"));
      });

      it("succeeded → succeeded (double finish)", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithNodeState("n1", "succeeded");
        const result = applyEvent(runs, {
          type: "node.succeeded",
          runId: "run-1",
          at: 1300,
          nodeId: "n1",
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalled();
      });

      it("succeeded → failed", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithNodeState("n1", "succeeded");
        const result = applyEvent(runs, {
          type: "node.failed",
          runId: "run-1",
          at: 1300,
          nodeId: "n1",
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalled();
      });

      it("failed → succeeded", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithNodeState("n1", "failed");
        const result = applyEvent(runs, {
          type: "node.succeeded",
          runId: "run-1",
          at: 1300,
          nodeId: "n1",
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalled();
      });

      it("succeeded → skipped", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithNodeState("n1", "succeeded");
        const result = applyEvent(runs, {
          type: "node.skipped",
          runId: "run-1",
          at: 1300,
          nodeId: "n1",
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalled();
      });
    });
  });

  // ── Edge transition guards ─────────────────────────────────────

  describe("edge transition guards", () => {
    describe("legal transitions", () => {
      it("idle → active (edge.activated)", () => {
        const runs = runsWithStarted();
        const result = applyEvent(runs, {
          type: "edge.activated",
          runId: "run-1",
          at: 1100,
          edgeId: "e1",
        });
        expect(result.get("run-1")?.edges.get("e1")?.status).toBe("active");
      });

      it("active → taken (edge.taken)", () => {
        const runs = runsWithEdgeState("e1", "active");
        const result = applyEvent(runs, {
          type: "edge.taken",
          runId: "run-1",
          at: 1200,
          edgeId: "e1",
        });
        expect(result.get("run-1")?.edges.get("e1")?.status).toBe("taken");
      });

      it("taken → active (re-activation)", () => {
        const runs = runsWithEdgeState("e1", "taken");
        const result = applyEvent(runs, {
          type: "edge.activated",
          runId: "run-1",
          at: 1300,
          edgeId: "e1",
        });
        expect(result.get("run-1")?.edges.get("e1")?.status).toBe("active");
      });
    });

    describe("illegal transitions — dropped with warning", () => {
      it("idle → taken (no activation)", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithStarted();
        const result = applyEvent(runs, {
          type: "edge.taken",
          runId: "run-1",
          at: 1200,
          edgeId: "e1",
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("illegal edge transition"));
      });
    });
  });

  // ── Run transition guards ──────────────────────────────────────

  describe("run transition guards", () => {
    describe("legal transitions", () => {
      it("running → completed", () => {
        const runs = runsWithRunStatus("running");
        const result = applyEvent(runs, {
          type: "run.completed",
          runId: "run-1",
          at: 2000,
        });
        expect(result.get("run-1")?.status).toBe("completed");
      });

      it("running → failed", () => {
        const runs = runsWithRunStatus("running");
        const result = applyEvent(runs, {
          type: "run.failed",
          runId: "run-1",
          at: 2000,
        });
        expect(result.get("run-1")?.status).toBe("failed");
      });

      it("running → cancelled", () => {
        const runs = runsWithRunStatus("running");
        const result = applyEvent(runs, {
          type: "run.cancelled",
          runId: "run-1",
          at: 2000,
        });
        expect(result.get("run-1")?.status).toBe("cancelled");
      });
    });

    describe("illegal transitions — dropped with warning", () => {
      it("completed → completed (double complete)", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithRunStatus("completed");
        const result = applyEvent(runs, {
          type: "run.completed",
          runId: "run-1",
          at: 3000,
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("illegal run transition"));
      });

      it("completed → failed", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithRunStatus("completed");
        const result = applyEvent(runs, {
          type: "run.failed",
          runId: "run-1",
          at: 3000,
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalled();
      });

      it("failed → cancelled", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithRunStatus("failed");
        const result = applyEvent(runs, {
          type: "run.cancelled",
          runId: "run-1",
          at: 3000,
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalled();
      });

      it("cancelled → completed", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = runsWithRunStatus("cancelled");
        const result = applyEvent(runs, {
          type: "run.completed",
          runId: "run-1",
          at: 3000,
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalled();
      });

      it("nonexistent run → completed (missing run)", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
          /* silent */
        });
        const runs = emptyRuns();
        const result = applyEvent(runs, {
          type: "run.completed",
          runId: "run-1",
          at: 3000,
        });
        expect(result).toBe(runs);
        expect(warnSpy).toHaveBeenCalled();
      });
    });
  });

  // ── Warning message content ────────────────────────────────────

  describe("warning messages include context", () => {
    it("node warning includes nodeId, current status, and target status", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* silent */
      });
      const runs = runsWithNodeState("n1", "succeeded");
      applyEvent(runs, {
        type: "node.failed",
        runId: "run-1",
        at: 1300,
        nodeId: "n1",
      } as ExecutionEvent);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/n1.*succeeded.*failed/));
    });

    it("edge warning includes edgeId, current status, and target status", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* silent */
      });
      const runs = runsWithStarted();
      applyEvent(runs, {
        type: "edge.taken",
        runId: "run-1",
        at: 1200,
        edgeId: "e1",
      } as ExecutionEvent);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/e1.*idle.*taken/));
    });

    it("run warning includes runId, current status, and target status", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* silent */
      });
      const runs = runsWithRunStatus("completed");
      applyEvent(runs, {
        type: "run.failed",
        runId: "run-1",
        at: 3000,
      } as ExecutionEvent);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/run-1.*completed.*failed/));
    });
  });

  // ── State unchanged on illegal transition ──────────────────────

  describe("state unchanged on illegal transition", () => {
    it("node state object is identical reference after illegal transition", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* silent */
      });
      const runs = runsWithNodeState("n1", "idle");
      const nodesBefore = runs.get("run-1")?.nodes;

      const result = applyEvent(runs, {
        type: "node.succeeded",
        runId: "run-1",
        at: 1200,
        nodeId: "n1",
      } as ExecutionEvent);

      expect(result).toBe(runs);
      expect(result.get("run-1")?.nodes).toBe(nodesBefore);
      warnSpy.mockRestore();
    });

    it("edge state object is identical reference after illegal transition", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* silent */
      });
      const runs = runsWithStarted();
      const edgesBefore = runs.get("run-1")?.edges;

      const result = applyEvent(runs, {
        type: "edge.taken",
        runId: "run-1",
        at: 1200,
        edgeId: "e1",
      } as ExecutionEvent);

      expect(result).toBe(runs);
      expect(result.get("run-1")?.edges).toBe(edgesBefore);
      warnSpy.mockRestore();
    });
  });
});
