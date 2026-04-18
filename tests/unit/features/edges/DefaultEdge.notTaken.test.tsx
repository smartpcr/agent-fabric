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
 * Tests for "not taken" edge dimming on DefaultEdge.
 *
 * Verifies:
 * - `edge-not-taken` class applied when status === 'not-taken'.
 * - Class NOT applied for other statuses.
 * - Class removed when status transitions away from 'not-taken'.
 * - CSS file contains opacity + filter: saturate(0) rules.
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

const RUN_ID = "run-dim-1";

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

// ─── Not-taken class applied ────────────────────────────────────────

describe("DefaultEdge — not-taken dim", () => {
  it("applies edge-not-taken class when status is 'not-taken'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "not-taken" });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-not-taken")).toBe(true);
  });

  it("sets data-edge-status to 'not-taken'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "not-taken" });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    const edgeEl = screen.getByTestId("default-edge");
    expect(edgeEl.getAttribute("data-edge-status")).toBe("not-taken");
  });
});

// ─── Not applied for other statuses ─────────────────────────────────

describe("DefaultEdge — no dim for other statuses", () => {
  it("does NOT apply edge-not-taken when status is 'idle'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "idle" });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge").classList.contains("edge-not-taken")).toBe(false);
  });

  it("does NOT apply edge-not-taken when status is 'active'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge").classList.contains("edge-not-taken")).toBe(false);
  });

  it("does NOT apply edge-not-taken when status is 'taken'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "taken", activatedAt: 100, takenAt: 200 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge").classList.contains("edge-not-taken")).toBe(false);
  });

  it("does NOT apply edge-not-taken when status is 'succeeded'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "succeeded", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge").classList.contains("edge-not-taken")).toBe(false);
  });

  it("does NOT apply edge-not-taken when status is 'failed'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "failed", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge").classList.contains("edge-not-taken")).toBe(false);
  });

  it("does NOT apply edge-not-taken when there is no execution state", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps()} />
      </svg>,
    );

    const pathEl = screen.getByTestId("base-edge");
    expect(pathEl.classList.contains("edge-not-taken")).toBe(false);
  });
});

// ─── Transitions ────────────────────────────────────────────────────

describe("DefaultEdge — not-taken transitions", () => {
  it("removes edge-not-taken when status transitions away from 'not-taken'", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "not-taken" });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge").classList.contains("edge-not-taken")).toBe(true);

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    expect(screen.getByTestId("base-edge").classList.contains("edge-not-taken")).toBe(false);
  });

  it("applies edge-not-taken when transitioning from active to not-taken", () => {
    act(() => {
      store.getState().startRun(RUN_ID);
      setRunWithEdge(RUN_ID, "edge-1", { status: "active", activatedAt: 100 });
    });

    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ id: "edge-1" })} />
      </svg>,
    );

    expect(screen.getByTestId("base-edge").classList.contains("edge-not-taken")).toBe(false);

    act(() => {
      setRunWithEdge(RUN_ID, "edge-1", { status: "not-taken" });
    });

    expect(screen.getByTestId("base-edge").classList.contains("edge-not-taken")).toBe(true);
  });
});

// ─── CSS file verification ──────────────────────────────────────────

describe("edgeAnimations.css — not-taken dim styles", () => {
  const cssPath = resolve(__dirname, "../../../..", "src/features/edges/edgeAnimations.css");
  let cssContent: string;

  beforeEach(() => {
    cssContent = readFileSync(cssPath, "utf-8");
  });

  it("defines .edge-not-taken class", () => {
    expect(cssContent).toMatch(/\.edge-not-taken\s*\{/);
  });

  it(".edge-not-taken reduces opacity", () => {
    expect(cssContent).toMatch(/\.edge-not-taken\s*\{[^}]*opacity:\s*[\d.]+/);
  });

  it(".edge-not-taken applies desaturation filter", () => {
    expect(cssContent).toMatch(/\.edge-not-taken\s*\{[^}]*filter:\s*saturate\(0\)/);
  });
});
