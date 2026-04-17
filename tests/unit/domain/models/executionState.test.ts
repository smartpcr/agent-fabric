import { describe, it, expect } from "vitest";
import {
  pendingNode,
  runningNode,
  successNode,
  errorNode,
  skippedNode,
  pendingEdge,
  activeEdge,
  completedEdge,
  skippedEdge,
  type NodeExecutionState,
  type EdgeExecutionState,
} from "@/domain/models/executionState";
import { assertNever } from "@/utils/assertNever";

describe("NodeExecutionState", () => {
  it("constructs a pending state via factory", () => {
    const state = pendingNode();
    expect(state.status).toBe("pending");
  });

  it("constructs a running state with startedAt", () => {
    const state = runningNode(1000);
    expect(state.status).toBe("running");
    if (state.status === "running") {
      expect(state.startedAt).toBe(1000);
      expect(state.iteration).toBeUndefined();
    }
  });

  it("constructs a running state with iteration", () => {
    const state = runningNode(1000, 3);
    if (state.status === "running") {
      expect(state.iteration).toBe(3);
    }
  });

  it("constructs a success state with finishedAt", () => {
    const state = successNode(2000);
    expect(state.status).toBe("success");
    if (state.status === "success") {
      expect(state.finishedAt).toBe(2000);
      expect(state.result).toBeUndefined();
    }
  });

  it("constructs a success state with result", () => {
    const state = successNode(2000, { output: "done" });
    if (state.status === "success") {
      expect(state.result).toEqual({ output: "done" });
    }
  });

  it("constructs an error state", () => {
    const state = errorNode(3000, "something failed");
    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.finishedAt).toBe(3000);
      expect(state.error).toBe("something failed");
    }
  });

  it("constructs a skipped state via factory", () => {
    const state = skippedNode();
    expect(state.status).toBe("skipped");
  });

  it("supports exhaustive matching via assertNever", () => {
    function describeState(state: NodeExecutionState): string {
      switch (state.status) {
        case "pending":
          return "pending";
        case "running":
          return "running";
        case "success":
          return "success";
        case "error":
          return "error";
        case "skipped":
          return "skipped";
        default:
          return assertNever(state);
      }
    }
    expect(describeState(pendingNode())).toBe("pending");
    expect(describeState(skippedNode())).toBe("skipped");
  });
});

describe("EdgeExecutionState", () => {
  it("constructs a pending state via factory", () => {
    const state = pendingEdge();
    expect(state.status).toBe("pending");
  });

  it("constructs an active state via factory", () => {
    const state = activeEdge(500);
    expect(state.status).toBe("active");
    if (state.status === "active") {
      expect(state.activatedAt).toBe(500);
    }
  });

  it("constructs a completed state via factory", () => {
    const state = completedEdge(1500);
    expect(state.status).toBe("completed");
    if (state.status === "completed") {
      expect(state.completedAt).toBe(1500);
    }
  });

  it("constructs a skipped state via factory", () => {
    const state = skippedEdge();
    expect(state.status).toBe("skipped");
  });

  it("supports exhaustive matching via assertNever", () => {
    function describeState(state: EdgeExecutionState): string {
      switch (state.status) {
        case "pending":
          return "pending";
        case "active":
          return "active";
        case "completed":
          return "completed";
        case "skipped":
          return "skipped";
        default:
          return assertNever(state);
      }
    }
    expect(describeState(activeEdge(0))).toBe("active");
  });
});

describe("assertNever", () => {
  it("throws on unexpected value", () => {
    expect(() => assertNever("bad" as never)).toThrow("Unexpected value");
  });

  it("includes the value in the error message", () => {
    expect(() => assertNever(42 as never)).toThrow("42");
  });
});
