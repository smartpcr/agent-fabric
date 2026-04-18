import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { applyEvent, type RunState } from "@/store/slices/executionSlice";
import { createStore, type WorkflowState } from "@/store/createStore";
import { clearExecutionSelectorCache } from "@/store/selectors/executionSelectors";
import type { ExecutionEvent } from "@/domain/models/executionEvent";
import type { StoreApi } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { ReactNode } from "react";

/**
 * Performance integration test for execution event processing on a 200-node graph.
 *
 * Two test suites:
 *  1. Pure reducer performance — times `applyEvent` calls directly.
 *  2. Store→selector→render pipeline — drives events through a real zustand
 *     store with 200 rendered DefaultEdge components, measuring the full
 *     update cycle per event (store dispatch + selector eval + React re-render).
 *
 * Both assert p95 < 16ms (one frame budget at 60fps).
 */

const NODE_COUNT = 200;
const EDGE_COUNT = NODE_COUNT - 1;
const EVENTS_PER_SECOND = 20;
const DURATION_SECONDS = 10;
const TOTAL_EVENTS = EVENTS_PER_SECOND * DURATION_SECONDS;
const P95_BUDGET_MS = 16;

const TOTAL_EVENTS_STR = String(TOTAL_EVENTS);
const P95_BUDGET_STR = String(P95_BUDGET_MS);
const NODE_COUNT_STR = String(NODE_COUNT);

/** Generate node IDs for the 200-node graph. */
function nodeId(i: number): string {
  return `node-${String(i)}`;
}

/** Generate edge IDs for the 200-node chain. */
function edgeId(i: number): string {
  return `edge-${String(i)}`;
}

/** Build an initial runs map with a started run containing 200 nodes and 199 edges. */
function buildInitialRuns(runId: string): Map<string, RunState> {
  const nodes = new Map<string, { status: "idle"; startedAt?: undefined }>();
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.set(nodeId(i), { status: "idle" });
  }

  const edges = new Map<string, { status: "idle"; activatedAt?: undefined }>();
  for (let i = 0; i < EDGE_COUNT; i++) {
    edges.set(edgeId(i), { status: "idle" });
  }

  const runs = new Map<string, RunState>();
  runs.set(runId, {
    nodes,
    edges,
    status: "running",
    startedAt: Date.now(),
    eventLog: [],
  });
  return runs;
}

/**
 * Generate a realistic stream of execution events that cycles through nodes
 * and edges in the 200-node graph. Events alternate between node and edge
 * operations to simulate a realistic execution flow.
 */
function generateEventStream(runId: string, count: number): ExecutionEvent[] {
  const events: ExecutionEvent[] = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    const at = baseTime + i * (1000 / EVENTS_PER_SECOND);
    const nodeIndex = i % NODE_COUNT;
    const edgeIndex = i % EDGE_COUNT;

    if (i % 4 === 0) {
      events.push({
        type: "node.started",
        runId,
        nodeId: nodeId(nodeIndex),
        at,
      });
    } else if (i % 4 === 1) {
      events.push({
        type: "node.succeeded",
        runId,
        nodeId: nodeId(nodeIndex),
        at,
      });
    } else if (i % 4 === 2) {
      events.push({
        type: "edge.activated",
        runId,
        edgeId: edgeId(edgeIndex),
        at,
      });
    } else {
      events.push({
        type: "edge.taken",
        runId,
        edgeId: edgeId(edgeIndex),
        at,
      });
    }
  }
  return events;
}

/** Compute the p-th percentile from a sorted array of numbers. */
function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ═══════════════════════════════════════════════════════════════════════
// Suite 1: Pure reducer performance
// ═══════════════════════════════════════════════════════════════════════

describe("execution performance — reducer layer", () => {
  const RUN_ID = "perf-run-1";

  it(`processes ${TOTAL_EVENTS_STR} events with p95 < ${P95_BUDGET_STR}ms`, () => {
    let runs = buildInitialRuns(RUN_ID);
    const events = generateEventStream(RUN_ID, TOTAL_EVENTS);
    const timings: number[] = [];

    for (const event of events) {
      const start = performance.now();
      runs = applyEvent(runs, event);
      const elapsed = performance.now() - start;
      timings.push(elapsed);
    }

    timings.sort((a, b) => a - b);

    const p50 = percentile(timings, 50);
    const p95 = percentile(timings, 95);
    const p99 = percentile(timings, 99);
    const max = timings[timings.length - 1];

    // eslint-disable-next-line no-console
    console.log(
      `[exec-perf-reducer] ${TOTAL_EVENTS_STR} events on ${NODE_COUNT_STR}-node graph: ` +
        `p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms p99=${p99.toFixed(3)}ms max=${max.toFixed(3)}ms`,
    );

    expect(runs.has(RUN_ID)).toBe(true);
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });

  it("handles sustained burst without degradation over time", () => {
    let runs = buildInitialRuns(RUN_ID);
    const events = generateEventStream(RUN_ID, TOTAL_EVENTS);

    const half = Math.floor(events.length / 2);
    const firstHalf = events.slice(0, half);
    const secondHalf = events.slice(half);

    const firstTimings: number[] = [];
    const secondTimings: number[] = [];

    for (const event of firstHalf) {
      const start = performance.now();
      runs = applyEvent(runs, event);
      firstTimings.push(performance.now() - start);
    }

    for (const event of secondHalf) {
      const start = performance.now();
      runs = applyEvent(runs, event);
      secondTimings.push(performance.now() - start);
    }

    firstTimings.sort((a, b) => a - b);
    secondTimings.sort((a, b) => a - b);

    const firstP95 = percentile(firstTimings, 95);
    const secondP95 = percentile(secondTimings, 95);

    // eslint-disable-next-line no-console
    console.log(
      `[exec-perf-sustained] first-half p95=${firstP95.toFixed(3)}ms, ` +
        `second-half p95=${secondP95.toFixed(3)}ms`,
    );

    expect(firstP95).toBeLessThan(P95_BUDGET_MS);
    expect(secondP95).toBeLessThan(P95_BUDGET_MS);

    if (firstP95 > 0.001) {
      expect(secondP95 / firstP95).toBeLessThan(3);
    }
  });

  it("run state is correctly updated after full event stream", () => {
    let runs = buildInitialRuns(RUN_ID);
    const events = generateEventStream(RUN_ID, TOTAL_EVENTS);

    for (const event of events) {
      runs = applyEvent(runs, event);
    }

    const run = runs.get(RUN_ID);
    expect(run).toBeDefined();
    expect(run!.status).toBe("running"); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(run!.nodes.size).toBeGreaterThan(0); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(run!.edges.size).toBeGreaterThan(0); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Suite 2: Store → selector → edge-render pipeline performance
// ═══════════════════════════════════════════════════════════════════════

let store: StoreApi<WorkflowState>;

vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector?: unknown, equalityFn?: unknown) =>
    useStoreWithEqualityFn(
      store,
      selector as (s: WorkflowState) => unknown,
      equalityFn as ((a: unknown, b: unknown) => boolean) | undefined,
    ),
}));

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
      className={props.className}
      style={props.style}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

const { DefaultEdge } = await import("@/features/edges/DefaultEdge");

const PIPELINE_RUN_ID = "pipeline-run-1";
const PIPELINE_EDGE_COUNT = 199;

/** Generate edge props for the 200-node chain. */
function makeEdgeProps(idx: number) {
  return {
    id: edgeId(idx),
    source: nodeId(idx),
    target: nodeId(idx + 1),
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "bottom",
    targetPosition: "top",
    type: "default",
    animated: false,
    selected: false,
    selectable: true,
    deletable: true,
    data: {},
    style: {},
  };
}

/** Render 199 DefaultEdge components in a graph canvas. */
function EdgeCanvas() {
  const edges = [];
  for (let i = 0; i < PIPELINE_EDGE_COUNT; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test harness, props match EdgeProps shape
    edges.push(<DefaultEdge key={edgeId(i)} {...(makeEdgeProps(i) as any)} />);
  }
  return <svg data-testid="perf-canvas">{edges}</svg>;
}

describe("execution performance — store→selector→render pipeline", () => {
  beforeEach(() => {
    store = createStore();
    store.getState().startRun(PIPELINE_RUN_ID);
  });

  afterEach(() => {
    cleanup();
    clearExecutionSelectorCache();
  });

  it(`store→selector→render: ${TOTAL_EVENTS_STR} events on ${NODE_COUNT_STR}-node graph, p95 < ${P95_BUDGET_STR}ms`, () => {
    render(<EdgeCanvas />);

    const events = generateEventStream(PIPELINE_RUN_ID, TOTAL_EVENTS);
    const timings: number[] = [];
    const dispatch = store.getState().applyExecutionEvent;

    for (const event of events) {
      const start = performance.now();
      act(() => {
        dispatch(event);
      });
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);

    const p50 = percentile(timings, 50);
    const p95 = percentile(timings, 95);
    const p99 = percentile(timings, 99);
    const max = timings[timings.length - 1];

    // eslint-disable-next-line no-console
    console.log(
      `[exec-perf-pipeline] ${TOTAL_EVENTS_STR} events, ${String(PIPELINE_EDGE_COUNT)} rendered edges: ` +
        `p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms p99=${p99.toFixed(3)}ms max=${max.toFixed(3)}ms`,
    );

    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });

  it("cadence-driven: fake-timer events at 50ms intervals, p95 < 16ms", () => {
    // Capture real performance.now before faking timers so measurements stay real
    const realPerfNow = performance.now.bind(performance);

    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
    });

    render(<EdgeCanvas />);

    const timings: number[] = [];
    const baseTime = Date.now();
    const cadenceDispatch = store.getState().applyExecutionEvent;

    for (let i = 0; i < TOTAL_EVENTS; i++) {
      const eventIdx = i % 4;
      const nodeIndex = i % NODE_COUNT;
      const edgeIndex = i % EDGE_COUNT;

      let event: ExecutionEvent;
      if (eventIdx === 0) {
        event = {
          type: "node.started",
          runId: PIPELINE_RUN_ID,
          nodeId: nodeId(nodeIndex),
          at: baseTime + i * 50,
        };
      } else if (eventIdx === 1) {
        event = {
          type: "node.succeeded",
          runId: PIPELINE_RUN_ID,
          nodeId: nodeId(nodeIndex),
          at: baseTime + i * 50,
        };
      } else if (eventIdx === 2) {
        event = {
          type: "edge.activated",
          runId: PIPELINE_RUN_ID,
          edgeId: edgeId(edgeIndex),
          at: baseTime + i * 50,
        };
      } else {
        event = {
          type: "edge.taken",
          runId: PIPELINE_RUN_ID,
          edgeId: edgeId(edgeIndex),
          at: baseTime + i * 50,
        };
      }

      // Advance fake clock by 50ms to simulate real cadence
      vi.advanceTimersByTime(50);

      const start = realPerfNow();
      act(() => {
        cadenceDispatch(event);
      });
      timings.push(realPerfNow() - start);
    }

    vi.useRealTimers();

    timings.sort((a, b) => a - b);
    const p95 = percentile(timings, 95);

    // eslint-disable-next-line no-console
    console.log(
      `[exec-perf-cadence] cadence-driven p95=${p95.toFixed(3)}ms ` +
        `median=${percentile(timings, 50).toFixed(3)}ms max=${timings[timings.length - 1].toFixed(3)}ms`,
    );

    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});
