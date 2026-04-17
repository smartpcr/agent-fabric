import { describe, it, expect } from "vitest";
import type { NodeExecutionState, EdgeExecutionState } from "@/domain/models/executionState";
import { assertNever } from "@/utils/assertNever";

describe("NodeExecutionState", () => {
  it("constructs a pending state", () => {
    const state: NodeExecutionState = { status: "pending" };
    expect(state.status).toBe("pending");
  });

  it("constructs a running state with startedAt", () => {
    const state: NodeExecutionState = {
      status: "running",
      startedAt: 1000,
    };
    expect(state.status).toBe("running");
    expect(state.startedAt).toBe(1000);
    expect(state.iteration).toBeUndefined();
  });

  it("constructs a running state with iteration", () => {
    const state: NodeExecutionState = {
      status: "running",
      startedAt: 1000,
      iteration: 3,
    };
    expect(state.iteration).toBe(3);
  });

  it("constructs a success state with finishedAt", () => {
    const state: NodeExecutionState = {
      status: "success",
      finishedAt: 2000,
    };
    expect(state.status).toBe("success");
    expect(state.finishedAt).toBe(2000);
    expect(state.result).toBeUndefined();
  });

  it("constructs a success state with result", () => {
    const state: NodeExecutionState = {
      status: "success",
      finishedAt: 2000,
      result: { output: "done" },
    };
    expect(state.result).toEqual({ output: "done" });
  });

  it("constructs an error state", () => {
    const state: NodeExecutionState = {
      status: "error",
      finishedAt: 3000,
      error: "something failed",
    };
    expect(state.status).toBe("error");
    expect(state.finishedAt).toBe(3000);
    expect(state.error).toBe("something failed");
  });

  it("constructs a skipped state", () => {
    const state: NodeExecutionState = { status: "skipped" };
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
    expect(describeState({ status: "pending" })).toBe("pending");
    expect(describeState({ status: "skipped" })).toBe("skipped");
  });
});

describe("EdgeExecutionState", () => {
  it("constructs a pending state", () => {
    const state: EdgeExecutionState = { status: "pending" };
    expect(state.status).toBe("pending");
  });

  it("constructs an active state", () => {
    const state: EdgeExecutionState = {
      status: "active",
      activatedAt: 500,
    };
    expect(state.status).toBe("active");
    expect(state.activatedAt).toBe(500);
  });

  it("constructs a completed state", () => {
    const state: EdgeExecutionState = {
      status: "completed",
      completedAt: 1500,
    };
    expect(state.status).toBe("completed");
    expect(state.completedAt).toBe(1500);
  });

  it("constructs a skipped state", () => {
    const state: EdgeExecutionState = { status: "skipped" };
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
    expect(describeState({ status: "active", activatedAt: 0 })).toBe("active");
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
