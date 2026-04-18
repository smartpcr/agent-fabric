import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { createStore, type WorkflowState } from "@/store/createStore";
import { clearExecutionSelectorCache } from "@/store/selectors/executionSelectors";
import type { RunState, EdgeExecutionState } from "@/store/slices/executionSlice";
import type { StoreApi } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { EdgeProps } from "@xyflow/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Tests for loop-back pulse animation on LoopBackEdge.
 *
 * Verifies:
 * - `loop-back-pulse` class applied when edge iteration increments.
 * - Class NOT applied on initial render (first iteration value).
 * - Class auto-cleared after 400ms.
 * - Multiple iteration increments each trigger a pulse.
 * - CSS file defines the pulse keyframes and class.
 */

let store: StoreApi<WorkflowState>;

// Mock the store-hook boundary
vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector?: unknown, equalityFn?: unknown) =>
    useStoreWithEqualityFn(
      store,
      selector as (s: WorkflowState) => unknown,
      equalityFn as ((a: unknown, b: unknown) => boolean) | undefined,
    ),
}));

// Mock @xyflow/react — BaseEdge passes className through
vi.mock("@xyflow/react", () => ({
  BaseEdge: (props: {
    id?: string;
    path: string;
    markerEnd?: string;
    style?: React.CSSProperties;
    className?: string;
  }) => (
    <path
      data-testid="base-edge"
      d={props.path}
      data-marker-end={props.markerEnd}
      style={props.style}
      className={props.className}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

// Import after mock
const { LoopBackEdge } = await import("@/features/edges/LoopBackEdge");

const RUN_ID = "run-pulse-1";

// ─── Helpers ────────────────────────────────────────────────────────

function makeEdgeProps(overrides: Partial<EdgeProps> = {}): EdgeProps {
  return {
    id: "edge-loop-1",
    source: "loop-node",
    target: "loop-node",
    sourceX: 200,
    sourceY: 100,
    targetX: 50,
    targetY: 200,
    sourcePosition: "right" as never,
    targetPosition: "left" as never,
    type: "loop-back",
    animated: false,
    selected: false,
    selectable: true,
    deletable: true,
    data: {},
    style: {},
    ...overrides,
  } as EdgeProps;
}

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

// ─── Test setup ─────────────────────────────────────────────────────

beforeEach(() => {
  store = createStore();
});

afterEach(() => {
  cleanup();
  clearExecutionSelectorCache();
});

// ─── Pulse class on iteration increment ─────────────────────────────

describe("LoopBackEdge — pulse on iteration increment", () => {
  it("applies loop-back-pulse when iteration increments from 0 to 1", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 0,
      });
    });

    render(
      <svg>
        <LoopBackEdge {...makeEdgeProps({ id: "edge-loop-1" })} />
      </svg>,
    );

    // Increment iteration
    act(() => {
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 1,
      });
    });

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("loop-back-pulse")).toBe(true);
  });

  it("applies loop-back-pulse when iteration increments from 1 to 2", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 1,
      });
    });

    render(
      <svg>
        <LoopBackEdge {...makeEdgeProps({ id: "edge-loop-1" })} />
      </svg>,
    );

    act(() => {
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 2,
      });
    });

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("loop-back-pulse")).toBe(true);
  });

  it("does NOT apply pulse on initial render (no prior iteration)", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 0,
      });
    });

    render(
      <svg>
        <LoopBackEdge {...makeEdgeProps({ id: "edge-loop-1" })} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("loop-back-pulse")).toBe(false);
  });

  it("does NOT apply pulse when iteration is undefined", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
      });
    });

    render(
      <svg>
        <LoopBackEdge {...makeEdgeProps({ id: "edge-loop-1" })} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("loop-back-pulse")).toBe(false);
  });

  it("does NOT apply pulse when there is no execution state", () => {
    render(
      <svg>
        <LoopBackEdge {...makeEdgeProps()} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("loop-back-pulse")).toBe(false);
  });

  it("always has loop-back-edge class regardless of pulse", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 0,
      });
    });

    render(
      <svg>
        <LoopBackEdge {...makeEdgeProps({ id: "edge-loop-1" })} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("loop-back-edge")).toBe(true);
  });
});

// ─── Pulse auto-cleared after timer ─────────────────────────────────

describe("LoopBackEdge — pulse auto-cleared after 400ms", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes loop-back-pulse after 400ms", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 0,
      });
    });

    render(
      <svg>
        <LoopBackEdge {...makeEdgeProps({ id: "edge-loop-1" })} />
      </svg>,
    );

    act(() => {
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 1,
      });
    });

    expect(screen.getByTestId("base-edge").classList.contains("loop-back-pulse")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByTestId("base-edge").classList.contains("loop-back-pulse")).toBe(false);
  });

  it("pulse still present before 400ms", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 0,
      });
    });

    render(
      <svg>
        <LoopBackEdge {...makeEdgeProps({ id: "edge-loop-1" })} />
      </svg>,
    );

    act(() => {
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 1,
      });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("base-edge").classList.contains("loop-back-pulse")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("base-edge").classList.contains("loop-back-pulse")).toBe(false);
  });

  it("second iteration increment re-triggers pulse after first clears", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 0,
      });
    });

    render(
      <svg>
        <LoopBackEdge {...makeEdgeProps({ id: "edge-loop-1" })} />
      </svg>,
    );

    // First increment
    act(() => {
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 1,
      });
    });

    expect(screen.getByTestId("base-edge").classList.contains("loop-back-pulse")).toBe(true);

    // Clear first pulse
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByTestId("base-edge").classList.contains("loop-back-pulse")).toBe(false);

    // Second increment
    act(() => {
      setRunWithEdge(RUN_ID, "edge-loop-1", {
        status: "active",
        activatedAt: 100,
        iteration: 2,
      });
    });

    expect(screen.getByTestId("base-edge").classList.contains("loop-back-pulse")).toBe(true);
  });
});

// ─── CSS file verification ──────────────────────────────────────────

describe("edgeAnimations.css — loop-back pulse styles", () => {
  const cssPath = resolve(__dirname, "../../../..", "src/features/edges/edgeAnimations.css");
  let cssContent: string;

  beforeEach(() => {
    cssContent = readFileSync(cssPath, "utf-8");
  });

  it("defines @keyframes loop-pulse", () => {
    expect(cssContent).toContain("@keyframes loop-pulse");
  });

  it("defines .loop-back-pulse class with animation", () => {
    expect(cssContent).toMatch(/\.loop-back-pulse\s*\{[^}]*animation:\s*loop-pulse/);
  });

  it("pulse animation uses forwards fill mode", () => {
    expect(cssContent).toMatch(/\.loop-back-pulse\s*\{[^}]*forwards/);
  });

  it("includes reduced-motion override for pulse", () => {
    const reducedBlock = cssContent.slice(
      cssContent.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reducedBlock).toContain(".loop-back-pulse");
    expect(reducedBlock).toMatch(/animation:\s*none/);
  });
});
