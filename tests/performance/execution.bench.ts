import { describe, it, expect } from "vitest";
import { applyEvent, type RunState } from "@/store/slices/executionSlice";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

/**
 * Vitest benchmark for execution event processing performance.
 *
 * Simulates 20 events per second for 10 seconds (200 total events) against a
 * 200-node graph. Measures `applyEvent` throughput and per-event frame-time
 * budget compliance (p95 < 16ms).
 */

const NODE_COUNT = 200;
const EDGE_COUNT = NODE_COUNT - 1;
const EVENTS_PER_SECOND = 20;
const DURATION_SECONDS = 10;
const TOTAL_EVENTS = EVENTS_PER_SECOND * DURATION_SECONDS;
const P95_BUDGET_MS = 16;
const BENCH_ITERATIONS = 10;

const TOTAL_EVENTS_STR = String(TOTAL_EVENTS);
const P95_BUDGET_STR = String(P95_BUDGET_MS);
const NODE_COUNT_STR = String(NODE_COUNT);
const BENCH_ITERATIONS_STR = String(BENCH_ITERATIONS);

function nodeId(i: number): string {
  return `node-${String(i)}`;
}

function edgeId(i: number): string {
  return `edge-${String(i)}`;
}

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

function generateEventStream(runId: string, count: number): ExecutionEvent[] {
  const events: ExecutionEvent[] = [];
  const baseTime = Date.now();

  for (let i = 0; i < count; i++) {
    const at = baseTime + i * (1000 / EVENTS_PER_SECOND);
    const nodeIndex = i % NODE_COUNT;
    const edgeIndex = i % EDGE_COUNT;

    if (i % 4 === 0) {
      events.push({ type: "node.started", runId, nodeId: nodeId(nodeIndex), at });
    } else if (i % 4 === 1) {
      events.push({ type: "node.succeeded", runId, nodeId: nodeId(nodeIndex), at });
    } else if (i % 4 === 2) {
      events.push({ type: "edge.activated", runId, edgeId: edgeId(edgeIndex), at });
    } else {
      events.push({ type: "edge.taken", runId, edgeId: edgeId(edgeIndex), at });
    }
  }
  return events;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

const RUN_ID = "bench-run-1";

describe("execution event processing benchmark", () => {
  it(`applyEvent × ${TOTAL_EVENTS_STR} on ${NODE_COUNT_STR}-node graph — ${BENCH_ITERATIONS_STR} iterations`, () => {
    const iterationTimes: number[] = [];

    // Warmup
    for (let w = 0; w < 2; w++) {
      let runs = buildInitialRuns(RUN_ID);
      const events = generateEventStream(RUN_ID, TOTAL_EVENTS);
      for (const event of events) {
        runs = applyEvent(runs, event);
      }
    }

    // Measured iterations
    for (let iter = 0; iter < BENCH_ITERATIONS; iter++) {
      let runs = buildInitialRuns(RUN_ID);
      const events = generateEventStream(RUN_ID, TOTAL_EVENTS);

      const start = performance.now();
      for (const event of events) {
        runs = applyEvent(runs, event);
      }
      iterationTimes.push(performance.now() - start);
    }

    iterationTimes.sort((a, b) => a - b);
    const median = percentile(iterationTimes, 50);
    const p95Total = percentile(iterationTimes, 95);

    // eslint-disable-next-line no-console
    console.log(
      `[bench] ${BENCH_ITERATIONS_STR} iterations: median=${median.toFixed(2)}ms ` +
        `p95=${p95Total.toFixed(2)}ms per full ${TOTAL_EVENTS_STR}-event stream`,
    );

    // Each full stream should complete well under the total frame budget
    // (200 events × 16ms = 3200ms budget; actual should be <50ms total)
    expect(p95Total).toBeLessThan(3200);
  });

  it(`p95 per-event time < ${P95_BUDGET_STR}ms across ${TOTAL_EVENTS_STR} events`, () => {
    let runs = buildInitialRuns(RUN_ID);
    const events = generateEventStream(RUN_ID, TOTAL_EVENTS);
    const timings: number[] = [];

    for (const event of events) {
      const start = performance.now();
      runs = applyEvent(runs, event);
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const p95 = percentile(timings, 95);

    // eslint-disable-next-line no-console
    console.log(
      `[bench] p95=${p95.toFixed(3)}ms median=${percentile(timings, 50).toFixed(3)}ms ` +
        `max=${timings[timings.length - 1].toFixed(3)}ms`,
    );

    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});
