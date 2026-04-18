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
 * Tests for flash-on-success/error animation on DefaultEdge.
 *
 * Verifies:
 * - `edge-flash-success` class applied when edge transitions to 'taken' or 'succeeded'.
 * - `edge-flash-error` class applied when edge transitions to 'failed'.
 * - Flash class removed after animationEnd event fires.
 * - No flash when transitioning to non-terminal statuses.
 * - CSS file contains the correct flash keyframes and fill-mode.
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
  getBezierPath: vi.fn(() => ["M 0 0 C 50 0 50 100 100 100", 50, 50]),
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
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

// Import after mock
const { DefaultEdge } = await import("@/features/edges/DefaultEdge");

const RUN_ID = "run-flash-1";

// ─── Helpers ────────────────────────────────────────────────────────

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

function mockMatchMedia(prefersReducedMotion: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = (query: string) =>
    ({
      matches: query === "(prefers-reduced-motion: reduce)" ? prefersReducedMotion : false,
      media: query,
      onchange: null,
      addListener: () => {
        /* noop */
      },
      removeListener: () => {
        /* noop */
      },
      addEventListener: () => {
        /* noop */
      },
      removeEventListener: () => {
        /* noop */
      },
      dispatchEvent: () => false,
    }) as MediaQueryList;
  return () => {
    window.matchMedia = original;
  };
}

// ─── Test setup ─────────────────────────────────────────────────────

let restoreMatchMedia: () => void;

beforeEach(() => {
  store = createStore();
  restoreMatchMedia = mockMatchMedia(false);
});

afterEach(() => {
  restoreMatchMedia();
  cleanup();
  clearExecutionSelectorCache();
});

// ─── Flash class on success ─────────────────────────────────────────

describe("DefaultEdge — flash on success (taken)", () => {
  it("applies edge-flash-success when status transitions to 'taken'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    // Transition to taken
    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flash-success")).toBe(true);
  });

  it("applies edge-flash-success when status transitions to 'succeeded'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", { status: "succeeded", activatedAt: 100 });
    });

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flash-success")).toBe(true);
  });

  it("does NOT apply flash class when rendering with 'taken' as initial state", () => {
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

    const pathEl = screen.getByTestId("base-edge");
    // No flash because there was no prior status (no transition from active→taken)
    expect(pathEl.classList.contains("edge-flash-success")).toBe(false);
  });
});

// ─── Flash class on error ───────────────────────────────────────────

describe("DefaultEdge — flash on error (failed)", () => {
  it("applies edge-flash-error when status transitions to 'failed'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", { status: "failed", activatedAt: 100 });
    });

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flash-error")).toBe(true);
  });

  it("does NOT apply flash class when rendering with 'failed' as initial state", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "failed", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flash-error")).toBe(false);
  });
});

// ─── No flash on non-terminal transitions ───────────────────────────

describe("DefaultEdge — no flash on non-terminal transitions", () => {
  it("does NOT apply flash when transitioning idle → active", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "idle" });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flash-success")).toBe(false);
    expect(pathEl.classList.contains("edge-flash-error")).toBe(false);
  });
});

// ─── Flash removed after animation duration ─────────────────────────

describe("DefaultEdge — flash class removed after animation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("removes edge-flash-success class after 500ms", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    // Transition to trigger flash
    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flash-success")).toBe(true);

    // Advance past the 500ms flash duration
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(pathEl.classList.contains("edge-flash-success")).toBe(false);
  });

  it("removes edge-flash-error class after 500ms", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", { status: "failed", activatedAt: 100 });
    });

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flash-error")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(pathEl.classList.contains("edge-flash-error")).toBe(false);
  });

  it("flash class does not reappear without a new state transition", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    // Trigger flash
    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    expect(screen.getByTestId("base-edge").classList.contains("edge-flash-success")).toBe(true);

    // Clear flash via timer
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByTestId("base-edge").classList.contains("edge-flash-success")).toBe(false);

    // Setting the same status again (no actual transition) should NOT re-flash
    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    expect(screen.getByTestId("base-edge").classList.contains("edge-flash-success")).toBe(false);
  });

  it("flash is still present before 500ms elapses", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    // Advance only partially — flash should still be present
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("base-edge").classList.contains("edge-flash-success")).toBe(true);

    // Now complete the timer
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("base-edge").classList.contains("edge-flash-success")).toBe(false);
  });
});

// ─── CSS file verification ──────────────────────────────────────────

describe("edgeAnimations.css — flash animation structure", () => {
  const cssPath = resolve(__dirname, "../../../..", "src/features/edges/edgeAnimations.css");
  let cssContent: string;

  beforeEach(() => {
    cssContent = readFileSync(cssPath, "utf-8");
  });

  it("defines @keyframes edge-flash-success", () => {
    expect(cssContent).toContain("@keyframes edge-flash-success");
  });

  it("defines @keyframes edge-flash-error", () => {
    expect(cssContent).toContain("@keyframes edge-flash-error");
  });

  it("success flash uses green stroke (#22c55e)", () => {
    const successBlock = cssContent.slice(
      cssContent.indexOf("@keyframes edge-flash-success"),
      cssContent.indexOf("}", cssContent.indexOf("@keyframes edge-flash-success")) + 20,
    );
    expect(successBlock).toContain("#22c55e");
  });

  it("error flash uses red stroke (#ef4444)", () => {
    const errorBlock = cssContent.slice(
      cssContent.indexOf("@keyframes edge-flash-error"),
      cssContent.indexOf("}", cssContent.indexOf("@keyframes edge-flash-error")) + 20,
    );
    expect(errorBlock).toContain("#ef4444");
  });

  it(".edge-flash-success uses animation-fill-mode: forwards (via shorthand)", () => {
    expect(cssContent).toMatch(/\.edge-flash-success\s*\{[^}]*forwards/);
  });

  it(".edge-flash-error uses animation-fill-mode: forwards (via shorthand)", () => {
    expect(cssContent).toMatch(/\.edge-flash-error\s*\{[^}]*forwards/);
  });

  it("flash animations are 500ms duration", () => {
    expect(cssContent).toMatch(/\.edge-flash-success\s*\{[^}]*500ms/);
    expect(cssContent).toMatch(/\.edge-flash-error\s*\{[^}]*500ms/);
  });
});
