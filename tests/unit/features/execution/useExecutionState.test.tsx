import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createStore, type WorkflowState } from "@/store/createStore";
import { clearExecutionSelectorCache } from "@/store/selectors/executionSelectors";
import type { RunState, NodeExecutionState } from "@/store/slices/executionSlice";
import type { StoreApi } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";

/**
 * Integration tests for `useExecutionState` — exercises the real hook
 * logic (activeRunId + nodeId selector + memoized selector) against a real
 * zustand store created fresh per-test.
 *
 * Only `@/store/hooks` is mocked to redirect useWorkflowStore to the test
 * store. The real `useExecutionState` hook and `selectNodeExecutionState`
 * selector are exercised without mocking.
 */

let store: StoreApi<WorkflowState>;

// Mock only the store-hook boundary to use our controlled test store
vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector?: unknown, equalityFn?: unknown) =>
    useStoreWithEqualityFn(
      store,
      selector as (s: WorkflowState) => unknown,
      equalityFn as ((a: unknown, b: unknown) => boolean) | undefined,
    ),
}));

// Import after mock — real hook, real selector, test store
const { useExecutionState } = await import("@/features/execution/useExecutionState");

/** Apply a node state into a run within the vanilla store. */
function setRunWithNode(runId: string, nodeId: string, nodeState: NodeExecutionState): void {
  const state = store.getState();
  const runs = new Map(state.runs);
  const existingRun = runs.get(runId);
  const nodes = new Map<string, NodeExecutionState>(existingRun?.nodes ?? new Map());
  nodes.set(nodeId, nodeState);
  const base: RunState = existingRun ?? {
    edges: new Map(),
    status: "running" as const,
    startedAt: Date.now(),
    nodes: new Map<string, NodeExecutionState>(),
  };
  runs.set(runId, { ...base, nodes });
  store.setState({ runs });
}

beforeEach(() => {
  store = createStore();
});

afterEach(() => {
  clearExecutionSelectorCache();
});

describe("useExecutionState (real hook + real store)", () => {
  // ── Returns undefined when no active run ───────────────────────

  it("returns undefined when activeRunId is undefined", () => {
    const { result } = renderHook(() => useExecutionState("node-1"));
    expect(result.current).toBeUndefined();
  });

  // ── Returns undefined when activeRunId is set but node is absent ─

  it("returns undefined when active run has no state for the node", () => {
    act(() => {
      store.setState({ activeRunId: "run-1" });
      setRunWithNode("run-1", "other-node", { status: "running", startedAt: 100 });
    });

    const { result } = renderHook(() => useExecutionState("node-1"));
    expect(result.current).toBeUndefined();
  });

  // ── Reads initial state from store ────────────────────────────

  it("returns the node execution state from the active run", () => {
    act(() => {
      setRunWithNode("run-1", "node-A", { status: "running", startedAt: 100 });
      store.setState({ activeRunId: "run-1" });
    });

    const { result } = renderHook(() => useExecutionState("node-A"));
    expect(result.current).toBeDefined();
    expect(result.current?.status).toBe("running");
    expect(result.current?.startedAt).toBe(100);
  });

  // ── Reacts to store updates ────────────────────────────────────

  it("updates when node state transitions in the store", () => {
    act(() => {
      setRunWithNode("run-1", "node-B", { status: "running", startedAt: 100 });
      store.setState({ activeRunId: "run-1" });
    });

    const { result } = renderHook(() => useExecutionState("node-B"));
    expect(result.current?.status).toBe("running");

    act(() => {
      setRunWithNode("run-1", "node-B", {
        status: "succeeded",
        startedAt: 100,
        finishedAt: 200,
      });
    });

    expect(result.current?.status).toBe("succeeded");
    expect(result.current?.finishedAt).toBe(200);
  });

  it("updates when activeRunId changes", () => {
    act(() => {
      setRunWithNode("run-1", "node-C", { status: "running", startedAt: 100 });
      setRunWithNode("run-2", "node-C", {
        status: "succeeded",
        startedAt: 50,
        finishedAt: 60,
      });
      store.setState({ activeRunId: "run-1" });
    });

    const { result } = renderHook(() => useExecutionState("node-C"));
    expect(result.current?.status).toBe("running");

    act(() => {
      store.setState({ activeRunId: "run-2" });
    });

    expect(result.current?.status).toBe("succeeded");
  });

  // ── Iteration fields propagate ─────────────────────────────────

  it("includes iteration and totalIterations from store", () => {
    act(() => {
      setRunWithNode("run-1", "loop-1", {
        status: "running",
        startedAt: 100,
        iteration: 3,
        totalIterations: 10,
      });
      store.setState({ activeRunId: "run-1" });
    });

    const { result } = renderHook(() => useExecutionState("loop-1"));
    expect(result.current?.iteration).toBe(3);
    expect(result.current?.totalIterations).toBe(10);
  });

  // ── Cleanup on unmount ─────────────────────────────────────────

  it("result stays frozen after unmount (no post-unmount updates)", () => {
    act(() => {
      setRunWithNode("run-1", "node-D", { status: "running", startedAt: 100 });
      store.setState({ activeRunId: "run-1" });
    });

    const { result, unmount } = renderHook(() => useExecutionState("node-D"));
    expect(result.current?.status).toBe("running");

    unmount();

    // After unmount, mutating the store should NOT update the hook's result
    act(() => {
      setRunWithNode("run-1", "node-D", {
        status: "failed",
        startedAt: 100,
        finishedAt: 300,
        error: "boom",
      });
    });

    // result.current stays frozen at unmount value
    expect(result.current?.status).toBe("running");
  });

  it("does not cause re-render after unmount when store changes", () => {
    act(() => {
      setRunWithNode("run-1", "node-E", { status: "running", startedAt: 100 });
      store.setState({ activeRunId: "run-1" });
    });

    let renderCount = 0;
    const { unmount } = renderHook(() => {
      renderCount += 1;
      return useExecutionState("node-E");
    });

    const countAtUnmount = renderCount;
    unmount();

    // Mutate store after unmount
    act(() => {
      setRunWithNode("run-1", "node-E", {
        status: "succeeded",
        startedAt: 100,
        finishedAt: 200,
      });
    });

    // renderCount should not have increased after unmount
    expect(renderCount).toBe(countAtUnmount);
  });
});
