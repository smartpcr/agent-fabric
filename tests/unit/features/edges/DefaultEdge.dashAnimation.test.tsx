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
 * Tests for flowing-dash animation on DefaultEdge.
 *
 * Verifies:
 * - `edge-flow-active` class is applied to BaseEdge when status === 'active'.
 * - Class is removed when status transitions away from 'active'.
 * - Class is NOT applied under prefers-reduced-motion: reduce.
 * - CSS file contains the correct @keyframes, class, and reduced-motion media query.
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

// Mock @xyflow/react — BaseEdge passes className through to the path element
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

const RUN_ID = "run-dash-1";

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

beforeEach(() => {
  store = createStore();
});

afterEach(() => {
  cleanup();
  clearExecutionSelectorCache();
});

// ─── Flowing-dash class application ─────────────────────────────────

describe("DefaultEdge — flowing-dash animation (normal motion)", () => {
  let restoreMatchMedia: () => void;

  beforeEach(() => {
    restoreMatchMedia = mockMatchMedia(false);
  });

  afterEach(() => {
    restoreMatchMedia();
  });

  it("applies edge-flow-active class when edge status is 'active'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flow-active")).toBe(true);
  });

  it("does NOT apply edge-flow-active when edge status is 'idle'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "idle" });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flow-active")).toBe(false);
  });

  it("does NOT apply edge-flow-active when edge status is 'taken'", () => {
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
    expect(pathEl.classList.contains("edge-flow-active")).toBe(false);
  });

  it("does NOT apply edge-flow-active when there is no execution state", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps()} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flow-active")).toBe(false);
  });

  it("removes edge-flow-active when edge transitions from 'active' to 'taken'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge").classList.contains("edge-flow-active")).toBe(true);

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", {
        status: "taken",
        activatedAt: 100,
        takenAt: 200,
      });
    });

    expect(screen.getByTestId("base-edge").classList.contains("edge-flow-active")).toBe(false);
  });

  it("applies edge-flow-active when edge transitions from 'idle' to 'active'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "idle" });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge").classList.contains("edge-flow-active")).toBe(false);

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 200 });
    });

    expect(screen.getByTestId("base-edge").classList.contains("edge-flow-active")).toBe(true);
  });
});

// ─── Reduced-motion: class suppressed ───────────────────────────────

describe("DefaultEdge — flowing-dash under prefers-reduced-motion", () => {
  let restoreMatchMedia: () => void;

  beforeEach(() => {
    restoreMatchMedia = mockMatchMedia(true);
  });

  afterEach(() => {
    restoreMatchMedia();
  });

  it("does NOT apply edge-flow-active when reduced motion is preferred", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-flow-active")).toBe(false);
  });

  it("still renders the edge correctly with data-edge-status='active'", () => {
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
});

// ─── CSS file verification ──────────────────────────────────────────

describe("edgeAnimations.css structure", () => {
  const cssPath = resolve(__dirname, "../../../..", "src/features/edges/edgeAnimations.css");
  let cssContent: string;

  beforeEach(() => {
    cssContent = readFileSync(cssPath, "utf-8");
  });

  it("defines @keyframes edge-flow", () => {
    expect(cssContent).toContain("@keyframes edge-flow");
  });

  it("keyframe animates stroke-dashoffset to -16", () => {
    expect(cssContent).toMatch(/stroke-dashoffset:\s*-16/);
  });

  it("defines .edge-flow-active class with animation referencing edge-flow", () => {
    expect(cssContent).toMatch(/\.edge-flow-active\s*\{[^}]*animation:\s*edge-flow/);
  });

  it("defines stroke-dasharray in the .edge-flow-active class", () => {
    expect(cssContent).toMatch(/\.edge-flow-active\s*\{[^}]*stroke-dasharray/);
  });

  it("includes @media (prefers-reduced-motion: reduce) that disables animation", () => {
    expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");
    const reducedMotionBlock = cssContent.slice(
      cssContent.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reducedMotionBlock).toContain(".edge-flow-active");
    expect(reducedMotionBlock).toMatch(/animation:\s*none/);
  });
});
