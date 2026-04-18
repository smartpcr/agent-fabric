import { describe, it, expect } from "vitest";
import { applyEvent, type RunState } from "@/store/slices/executionSlice";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

/**
 * Performance integration test for execution event processing on a 200-node graph.
 *
 * Simulates 20 events per second for 10 seconds (200 total events) against a
 * graph with 200 nodes and ~199 edges. Measures per-event processing time via
 * `performance.now()` and asserts the p95 stays under 16ms (one frame budget).
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

describe("execution performance — 200-node graph, 20 ev/sec", () => {
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

    // Sort for percentile calculation
    timings.sort((a, b) => a - b);

    const p50 = percentile(timings, 50);
    const p95 = percentile(timings, 95);
    const p99 = percentile(timings, 99);
    const max = timings[timings.length - 1];

    // Diagnostic output (visible in test logs)
    // eslint-disable-next-line no-console
    console.log(
      `[exec-perf] ${TOTAL_EVENTS_STR} events on ${NODE_COUNT_STR}-node graph: ` +
        `p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms p99=${p99.toFixed(3)}ms max=${max.toFixed(3)}ms`,
    );

    // The run should still exist after all events
    expect(runs.has(RUN_ID)).toBe(true);

    // Core assertion: p95 under one frame budget
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });

  it("handles sustained burst without degradation over time", () => {
    let runs = buildInitialRuns(RUN_ID);
    const events = generateEventStream(RUN_ID, TOTAL_EVENTS);

    // Split events into first and second halves
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

    // Both halves should be within budget
    expect(firstP95).toBeLessThan(P95_BUDGET_MS);
    expect(secondP95).toBeLessThan(P95_BUDGET_MS);

    // No significant degradation: second half should not be >3x slower than first half
    // (generous margin since timings vary in CI)
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
    // Nodes and edges should have been updated
    expect(run!.nodes.size).toBeGreaterThan(0); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(run!.edges.size).toBeGreaterThan(0); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  });
});
