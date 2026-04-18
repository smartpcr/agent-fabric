import { describe, it, expect } from "vitest";
import { createStore } from "@/store/createStore";
import { makeNode, type WorkflowNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";

/**
 * Canvas pan/zoom performance benchmark.
 *
 * Generates a 500-node graph, then simulates a 1-second pan gesture
 * at 60 Hz (60 frames). Each frame:
 *   1. Updates viewport pan position via `setPan()`
 *   2. Reads `nodes` and `edges` from the store (simulating what
 *      React Flow does each render frame)
 *   3. Filters visible nodes within the current viewport window
 *
 * The benchmark measures per-frame computation time and asserts
 * that at least 55 of 60 frames complete within the 16.67 ms
 * single-frame budget — i.e. ≥ 55 fps equivalent.
 */

const NODE_COUNT = 500;
const EDGE_COUNT = NODE_COUNT - 1;
const TARGET_FPS = 60;
const MIN_FPS = 55;
const FRAME_BUDGET_MS = 1000 / TARGET_FPS; // ~16.67 ms

/** Grid layout constants for distributing 500 nodes. */
const COLS = 25;
const SPACING_X = 250;
const SPACING_Y = 120;

/** Viewport dimensions for visibility filtering. */
const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;

/**
 * Build a 500-node grid graph in the store.
 * Nodes are arranged in a 25×20 grid with edges connecting
 * each node to the next in row-major order.
 */
function populateStore(store: ReturnType<typeof createStore>): {
  nodes: WorkflowNode[];
} {
  const nodes: WorkflowNode[] = [];

  for (let i = 0; i < NODE_COUNT; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    nodes.push(
      makeNode({
        kind: "task",
        data: { label: `Node ${String(i)}` },
        position: { x: col * SPACING_X, y: row * SPACING_Y },
      }),
    );
  }

  const edges = [];
  for (let i = 0; i < EDGE_COUNT; i++) {
    edges.push(
      makeEdge({
        source: nodes[i].id,
        sourcePort: "out",
        target: nodes[i + 1].id,
        targetPort: "in",
      }),
    );
  }

  // Batch-restore to avoid 500 individual zustand updates
  store.getState().restoreGraph(nodes, edges);

  return { nodes };
}

/**
 * Simulate checking which nodes are "visible" within a viewport window.
 * This mirrors the culling logic that React Flow performs each frame.
 */
function filterVisibleNodes(
  nodes: readonly WorkflowNode[],
  panX: number,
  panY: number,
  zoom: number,
): WorkflowNode[] {
  const left = -panX / zoom;
  const top = -panY / zoom;
  const right = left + VIEWPORT_WIDTH / zoom;
  const bottom = top + VIEWPORT_HEIGHT / zoom;

  return nodes.filter((n) => {
    const nodeWidth = n.width ?? 180;
    const nodeHeight = n.height ?? 60;
    return (
      n.position.x + nodeWidth >= left &&
      n.position.x <= right &&
      n.position.y + nodeHeight >= top &&
      n.position.y <= bottom
    );
  });
}

describe("canvas 500-node pan/zoom benchmark", () => {
  it(`pan gesture over 1 second achieves ≥ ${String(MIN_FPS)} fps on ${String(NODE_COUNT)}-node graph`, () => {
    const store = createStore();
    populateStore(store);

    // Verify graph was populated
    expect(store.getState().nodes).toHaveLength(NODE_COUNT);
    expect(store.getState().edges).toHaveLength(EDGE_COUNT);

    // Simulate a horizontal pan: start at (0,0), move to (-2000, -500) over 60 frames
    const totalFrames = TARGET_FPS; // 60 frames = 1 second
    const panStartX = 0;
    const panStartY = 0;
    const panEndX = -2000;
    const panEndY = -500;

    const frameTimes: number[] = [];
    let framesWithinBudget = 0;

    // Warmup: 5 frames to prime caches and JIT
    for (let w = 0; w < 5; w++) {
      const t = w / 5;
      const px = panStartX + t * (panEndX - panStartX);
      const py = panStartY + t * (panEndY - panStartY);
      store.getState().setPan(px, py);
      const state = store.getState();
      filterVisibleNodes(state.nodes, state.panX, state.panY, state.zoom);
    }

    // Measured frames
    for (let frame = 0; frame < totalFrames; frame++) {
      const t = frame / (totalFrames - 1);
      const px = panStartX + t * (panEndX - panStartX);
      const py = panStartY + t * (panEndY - panStartY);

      const start = performance.now();

      // 1. Update viewport pan
      store.getState().setPan(px, py);

      // 2. Read full node/edge arrays (simulates React Flow reconciliation)
      const state = store.getState();
      const allNodes = state.nodes;
      const allEdges = state.edges;

      // 3. Filter visible nodes (viewport culling)
      const visible = filterVisibleNodes(allNodes, state.panX, state.panY, state.zoom);

      // 4. Touch edge data (simulates edge rendering decisions)
      let _edgeCount = 0;
      for (const edge of allEdges) {
        if (edge.source && edge.target) _edgeCount++;
      }

      const elapsed = performance.now() - start;
      frameTimes.push(elapsed);

      if (elapsed <= FRAME_BUDGET_MS) {
        framesWithinBudget++;
      }

      // Sanity: visible nodes should be a subset
      expect(visible.length).toBeLessThanOrEqual(NODE_COUNT);
      expect(visible.length).toBeGreaterThan(0);
    }

    // Sort for percentile analysis
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];
    const max = sorted[sorted.length - 1];

    // eslint-disable-next-line no-console
    console.log(
      `[canvas-bench] ${String(NODE_COUNT)} nodes, ${String(totalFrames)} frames: ` +
        `${String(framesWithinBudget)}/${String(totalFrames)} within budget ` +
        `(median=${median.toFixed(3)}ms p95=${p95.toFixed(3)}ms max=${max.toFixed(3)}ms)`,
    );

    // At least 55 of 60 frames must complete within the frame budget
    expect(framesWithinBudget).toBeGreaterThanOrEqual(MIN_FPS);
  });

  it("zoom in/out gesture maintains ≥ 55 fps", () => {
    const store = createStore();
    populateStore(store);

    const totalFrames = TARGET_FPS;
    const zoomStart = 1.0;
    const zoomEnd = 0.3; // zoom out
    let framesWithinBudget = 0;

    // Warmup
    for (let w = 0; w < 5; w++) {
      const t = w / 5;
      store.getState().setZoom(zoomStart + t * (zoomEnd - zoomStart));
      const state = store.getState();
      filterVisibleNodes(state.nodes, state.panX, state.panY, state.zoom);
    }

    const frameTimes: number[] = [];

    for (let frame = 0; frame < totalFrames; frame++) {
      const t = frame / (totalFrames - 1);
      const zoom = zoomStart + t * (zoomEnd - zoomStart);

      const start = performance.now();

      store.getState().setZoom(zoom);
      const state = store.getState();
      const visible = filterVisibleNodes(state.nodes, state.panX, state.panY, state.zoom);

      // Touch edges
      let _c = 0;
      for (const e of state.edges) {
        if (e.source) _c++;
      }

      const elapsed = performance.now() - start;
      frameTimes.push(elapsed);
      if (elapsed <= FRAME_BUDGET_MS) framesWithinBudget++;

      expect(visible.length).toBeGreaterThan(0);
    }

    const sorted = [...frameTimes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];

    // eslint-disable-next-line no-console
    console.log(
      `[canvas-bench-zoom] ${String(totalFrames)} frames: ` +
        `${String(framesWithinBudget)}/${String(totalFrames)} within budget ` +
        `(median=${median.toFixed(3)}ms p95=${p95.toFixed(3)}ms)`,
    );

    expect(framesWithinBudget).toBeGreaterThanOrEqual(MIN_FPS);
  });
});
