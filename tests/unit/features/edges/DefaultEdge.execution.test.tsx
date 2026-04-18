import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook } from "@testing-library/react";
import { createStore, type WorkflowState } from "@/store/createStore";
import { clearExecutionSelectorCache } from "@/store/selectors/executionSelectors";
import type { RunState, EdgeExecutionState } from "@/store/slices/executionSlice";
import type { StoreApi } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { EdgeProps } from "@xyflow/react";
import type { ReactNode } from "react";

/**
 * Execution-integration tests for `DefaultEdge`.
 *
 * Verifies:
 * - DefaultEdge consumes `useEdgeExecutionState(id)` to read edge execution state.
 * - Edge re-renders only on its own state change (not on unrelated graph/node changes).
 * - data-edge-status attribute reflects the current edge execution status.
 * - No subscription leak after unmount.
 *
 * Only `@/store/hooks` is mocked (to redirect to a test store).
 * `@xyflow/react` is mocked to render testable HTML in jsdom.
 * Everything else is real: useEdgeExecutionState, selectEdgeExecutionState, DefaultEdge.
 */

let store: StoreApi<WorkflowState>;

// Mock the store-hook boundary to use a controlled test store.
vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector?: unknown, equalityFn?: unknown) =>
    useStoreWithEqualityFn(
      store,
      selector as (s: WorkflowState) => unknown,
      equalityFn as ((a: unknown, b: unknown) => boolean) | undefined,
    ),
}));

// Mock @xyflow/react for testable rendering
vi.mock("@xyflow/react", () => ({
  getBezierPath: vi.fn(() => ["M 0 0 C 50 0 50 100 100 100", 50, 50]),
  BaseEdge: (props: {
    id?: string;
    path: string;
    markerEnd?: string;
    style?: React.CSSProperties;
  }) => (
    <path
      data-testid="base-edge"
      d={props.path}
      data-marker-end={props.markerEnd}
      style={props.style}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

// Import after mock so the real hook binds to our test store
const { DefaultEdge } = await import("@/features/edges/DefaultEdge");
const { useEdgeExecutionState } = await import("@/features/execution/useEdgeExecutionState");

const RUN_ID = "run-exec-1";

function makeEdgeProps(overrides: Partial<EdgeProps> = {}): EdgeProps {
  return {
    id: "edge-1",
    source: "node-a",
    target: "node-b",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "bottom" as never,
    targetPosition: "top" as never,
    type: "default",
    animated: false,
    selected: false,
    selectable: true,
    deletable: true,
    data: {},
    style: {},
    ...overrides,
  } as EdgeProps;
}

/** Set an edge execution state within a run in the vanilla store. */
function setRunWithEdge(runId: string, edgeId: string, edgeState: EdgeExecutionState): void {
  const state = store.getState();
  const runs = new Map(state.runs);
  const existingRun = runs.get(runId);
  const edges = new Map<string, EdgeExecutionState>(existingRun?.edges ?? new Map());
  edges.set(edgeId, edgeState);
  const base: RunState = existingRun ?? {
    nodes: new Map(),
    status: "running" as const,
    startedAt: Date.now(),
    edges: new Map<string, EdgeExecutionState>(),
  };
  runs.set(runId, { ...base, edges });
  store.setState({ runs });
}

beforeEach(() => {
  store = createStore();
});

afterEach(() => {
  cleanup();
  clearExecutionSelectorCache();
});

describe("DefaultEdge execution integration", () => {
  // ── No execution state present ─────────────────────────────────

  it("renders without data-edge-status when no active run", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps()} />
      </svg>,
    );

    const edgeEl = screen.getByTestId("default-edge");
    expect(edgeEl.getAttribute("data-edge-status")).toBeNull();
  });

  it("renders without data-edge-status when edge has no execution state", () => {
    act(() => {
      store.setState({ activeRunId: RUN_ID });
      store.getState().startRun(RUN_ID);
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps()} />
      </svg>,
    );

    const edgeEl = screen.getByTestId("default-edge");
    expect(edgeEl.getAttribute("data-edge-status")).toBeNull();
  });

  // ── Reads execution state from store ──────────────────────────

  it("shows data-edge-status='active' when edge is activated", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    const edgeEl = screen.getByTestId("default-edge");
    expect(edgeEl.getAttribute("data-edge-status")).toBe("active");
  });

  it("shows data-edge-status='taken' when edge is taken", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    const edgeEl = screen.getByTestId("default-edge");
    expect(edgeEl.getAttribute("data-edge-status")).toBe("taken");
  });

  // ── Reacts to store updates ───────────────────────────────────

  it("updates data-edge-status when edge state transitions", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("default-edge").getAttribute("data-edge-status")).toBe("active");

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    expect(screen.getByTestId("default-edge").getAttribute("data-edge-status")).toBe("taken");
  });

  it("updates when activeRunId changes", () => {
    act(() => {
      store.getState().startRun("run-A");
      store.getState().startRun("run-B");
      setRunWithEdge("run-A", "edge-1", { status: "active", activatedAt: 100 });
      setRunWithEdge("run-B", "edge-1", { status: "taken", activatedAt: 50, takenAt: 60 });
      store.setState({ activeRunId: "run-A" });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("default-edge").getAttribute("data-edge-status")).toBe("active");

    act(() => {
      store.setState({ activeRunId: "run-B" });
    });

    expect(screen.getByTestId("default-edge").getAttribute("data-edge-status")).toBe("taken");
  });

  // ── Re-renders only on own state change (hook-level) ─────────────

  it("does NOT re-render when a different edge's state changes", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useEdgeExecutionState("edge-1");
    });
    expect(result.current?.status).toBe("active");

    const countAfterMount = renderCount;

    // Mutate a different edge — should NOT cause edge-1 to re-render
    act(() => {
      setRunWithEdge(RUN_ID, "edge-other", { status: "active", activatedAt: 200 });
    });

    expect(renderCount).toBe(countAfterMount);
  });

  it("does NOT re-render when a node's execution state changes", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useEdgeExecutionState("edge-1");
    });
    expect(result.current?.status).toBe("active");

    const countAfterMount = renderCount;

    // Mutate a node execution state — should NOT cause edge-1 hook to re-render
    act(() => {
      store.getState().applyExecutionEvent({
        type: "node.started",
        runId: RUN_ID,
        nodeId: "some-node",
        at: 300,
      });
    });

    expect(renderCount).toBe(countAfterMount);
  });

  it("DOES re-render when its own edge state changes", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useEdgeExecutionState("edge-1");
    });
    expect(result.current?.status).toBe("active");

    const countAfterMount = renderCount;

    // Mutate own edge state — SHOULD cause re-render
    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    expect(renderCount).toBeGreaterThan(countAfterMount);
    expect(result.current?.status).toBe("taken");
  });

  it("does NOT re-render when unrelated graph state changes", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useEdgeExecutionState("edge-1");
    });
    expect(result.current?.status).toBe("active");

    const countAfterMount = renderCount;

    // Trigger an unrelated graph state change (add a node to graph)
    act(() => {
      store.setState({
        nodes: [
          ...store.getState().nodes,
          { id: "new-node", type: "action", position: { x: 0, y: 0 }, data: {} },
        ],
      });
    });

    expect(renderCount).toBe(countAfterMount);
  });

  // ── Cleanup on unmount ─────────────────────────────────────────

  it("does not re-render after unmount when store changes", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    let renderCount = 0;
    const { unmount } = renderHook(() => {
      renderCount += 1;
      return useEdgeExecutionState("edge-1");
    });

    const countAtUnmount = renderCount;
    unmount();

    // Mutate store after unmount
    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    expect(renderCount).toBe(countAtUnmount);
  });

  // ── data-edge-id attribute ────────────────────────────────────

  it("surfaces data-edge-id attribute matching the edge id prop", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "my-edge-42" })} />
      </svg>,
    );

    const edgeEl = screen.getByTestId("default-edge");
    expect(edgeEl.getAttribute("data-edge-id")).toBe("my-edge-42");
  });
});
