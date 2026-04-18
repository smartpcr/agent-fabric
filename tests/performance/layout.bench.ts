import { describe, it, expect, vi, beforeAll } from "vitest";
import { computeAffectedSubgraph } from "@/domain/layout/incrementalLayout";
import {
  makeGraph,
  addNodeToGraph,
  addEdgeToGraph,
  type WorkflowGraph,
} from "@/domain/models/graph";
import { makeNode, type WorkflowNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";
import type { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk-api";

/** Parse the source node id from an ELK extended edge's sources array. */
function edgeSourceId(edge: ElkExtendedEdge): string {
  return edge.sources[0]?.split(".")[0] ?? "";
}

/** Parse the target node id from an ELK extended edge's targets array. */
function edgeTargetId(edge: ElkExtendedEdge): string {
  return edge.targets[0]?.split(".")[0] ?? "";
}

/** Build adjacency and in-degree maps from edges. */
function buildAdjacency(
  nodeIds: string[],
  edges: ElkExtendedEdge[],
): { inDegree: Map<string, number>; adj: Map<string, string[]> } {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }
  for (const edge of edges) {
    const src = edgeSourceId(edge);
    const tgt = edgeTargetId(edge);
    if (src && tgt && adj.has(src)) {
      adj.get(src)?.push(tgt);
      inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1);
    }
  }
  return { inDegree, adj };
}

/** Topological sort via Kahn's algorithm. Returns ordered node ids. */
function topoSort(nodeIds: string[], edges: ElkExtendedEdge[]): string[] {
  const { inDegree, adj } = buildAdjacency(nodeIds, edges);

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  const order: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    order.push(cur);
    for (const neighbor of adj.get(cur) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }
  // Append unordered nodes (cycles or isolates)
  for (const id of nodeIds) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

/**
 * Realistic ELK stub that simulates actual layout work:
 * assigns layered positions based on topological order.
 */
function realisticElkLayout(elkGraph: ElkNode): ElkNode {
  const children = elkGraph.children ?? [];
  const edges = elkGraph.edges ?? [];

  const order = topoSort(
    children.map((c) => c.id),
    edges,
  );

  const SPACING_X = 200;
  const SPACING_Y = 80;
  const posMap = new Map<string, { x: number; y: number }>();
  let layer = 0;
  let yInLayer = 0;
  for (const id of order) {
    posMap.set(id, { x: layer * SPACING_X, y: yInLayer * SPACING_Y });
    yInLayer += 1;
    if (yInLayer >= 5) {
      yInLayer = 0;
      layer += 1;
    }
  }

  return {
    ...elkGraph,
    children: children.map((c) => ({
      ...c,
      x: posMap.get(c.id)?.x ?? 0,
      y: posMap.get(c.id)?.y ?? 0,
    })),
  };
}

// Mock elkjs with a realistic layout stub
vi.mock("elkjs/lib/elk.bundled.js", () => {
  // eslint-disable-next-line func-style -- must be function declaration for `new`
  const MockElk = vi.fn(function () {
    return {
      layout: vi.fn((graph: ElkNode) => Promise.resolve(realisticElkLayout(graph))),
      knownLayoutAlgorithms: vi.fn().mockResolvedValue([]),
      knownLayoutOptions: vi.fn().mockResolvedValue([]),
      knownLayoutCategories: vi.fn().mockResolvedValue([]),
      terminateWorker: vi.fn(),
    };
  });
  return { default: MockElk };
});

/**
 * Build a chain graph: n0 -> n1 -> n2 -> ... -> n(count-1).
 */
function buildChainGraph(count: number): {
  graph: WorkflowGraph;
  firstId: string;
  lastId: string;
} {
  const nodes: WorkflowNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push(makeNode({ kind: "task", data: {}, position: { x: i * 10, y: 0 } }));
  }

  let graph = makeGraph("bench");
  for (const node of nodes) {
    graph = addNodeToGraph(graph, node);
  }

  for (let i = 0; i < count - 1; i++) {
    graph = addEdgeToGraph(
      graph,
      makeEdge({
        source: nodes[i].id,
        sourcePort: "out",
        target: nodes[i + 1].id,
        targetPort: "in",
      }),
    );
  }

  return { graph, firstId: nodes[0].id, lastId: nodes[count - 1].id };
}

/**
 * Build a graph with two disconnected components of `halfSize` nodes each.
 */
function buildTwoComponentGraph(halfSize: number): {
  graph: WorkflowGraph;
  componentAId: string;
  componentBId: string;
} {
  const nodesA: WorkflowNode[] = [];
  const nodesB: WorkflowNode[] = [];

  for (let i = 0; i < halfSize; i++) {
    nodesA.push(makeNode({ kind: "task", data: {}, position: { x: i * 10, y: 0 } }));
    nodesB.push(makeNode({ kind: "task", data: {}, position: { x: i * 10, y: 100 } }));
  }

  let graph = makeGraph("bench-two");
  for (const node of [...nodesA, ...nodesB]) {
    graph = addNodeToGraph(graph, node);
  }

  for (let i = 0; i < halfSize - 1; i++) {
    graph = addEdgeToGraph(
      graph,
      makeEdge({
        source: nodesA[i].id,
        sourcePort: "out",
        target: nodesA[i + 1].id,
        targetPort: "in",
      }),
    );
    graph = addEdgeToGraph(
      graph,
      makeEdge({
        source: nodesB[i].id,
        sourcePort: "out",
        target: nodesB[i + 1].id,
        targetPort: "in",
      }),
    );
  }

  return {
    graph,
    componentAId: nodesA[0].id,
    componentBId: nodesB[0].id,
  };
}

describe("layout performance benchmarks", () => {
  it("computeAffectedSubgraph on 100-node chain completes under 200ms", () => {
    const { graph, firstId } = buildChainGraph(100);

    const start = performance.now();
    const sub = computeAffectedSubgraph(graph, firstId);
    const elapsed = performance.now() - start;

    expect(sub.nodes).toHaveLength(100);
    expect(sub.edges).toHaveLength(99);
    expect(elapsed).toBeLessThan(200);
  });

  it("computeAffectedSubgraph on 100-node two-component graph returns only 50 nodes", () => {
    const { graph, componentAId } = buildTwoComponentGraph(50);

    const start = performance.now();
    const sub = computeAffectedSubgraph(graph, componentAId);
    const elapsed = performance.now() - start;

    expect(sub.nodes).toHaveLength(50);
    expect(sub.edges).toHaveLength(49);
    expect(elapsed).toBeLessThan(200);
  });

  it("computeAffectedSubgraph on 500-node chain completes under 200ms", () => {
    const { graph, firstId } = buildChainGraph(500);

    const start = performance.now();
    const sub = computeAffectedSubgraph(graph, firstId);
    const elapsed = performance.now() - start;

    expect(sub.nodes).toHaveLength(500);
    expect(elapsed).toBeLessThan(200);
  });
});

describe("real incremental layout pipeline benchmarks", () => {
  type IncrementalLayoutFn = (
    graph: WorkflowGraph,
    changedNodeId: string,
    registry: { get: (kind: string) => undefined },
    strategy?: string,
  ) => Promise<WorkflowGraph>;

  let realIncrementalLayout: IncrementalLayoutFn;

  beforeAll(async () => {
    const mod = await import("@/domain/layout/incrementalLayout");
    realIncrementalLayout = mod.incrementalLayout;
  });

  it("incrementalLayout full pipeline on 100-node chain under 200ms", async () => {
    const { graph, firstId } = buildChainGraph(100);
    const stubRegistry = { get: () => undefined };

    // Warm-up run
    await realIncrementalLayout(graph, firstId, stubRegistry);

    const start = performance.now();
    const result = await realIncrementalLayout(graph, firstId, stubRegistry);
    const elapsed = performance.now() - start;

    expect(result.nodes).toHaveLength(100);
    // Verify positions were actually computed (not original)
    const anyMoved = result.nodes.some((n, i) => n.position.x !== graph.nodes[i].position.x);
    expect(anyMoved).toBe(true);
    expect(elapsed).toBeLessThan(200);
  });

  it("incrementalLayout on half-component (50 of 100 nodes) under 200ms", async () => {
    const { graph, componentAId, componentBId } = buildTwoComponentGraph(50);
    const stubRegistry = { get: () => undefined };

    // Warm-up
    await realIncrementalLayout(graph, componentAId, stubRegistry);

    const start = performance.now();
    const result = await realIncrementalLayout(graph, componentAId, stubRegistry);
    const elapsed = performance.now() - start;

    expect(result.nodes).toHaveLength(100);

    // Verify component A positions changed
    const compANodes = result.nodes.filter((n) =>
      graph.nodes.filter((gn) => gn.position.y === 0).some((gn) => gn.id === n.id),
    );
    const anyAMoved = compANodes.some((n) => {
      const orig = graph.nodes.find((gn) => gn.id === n.id);
      return orig && n.position.x !== orig.position.x;
    });
    expect(anyAMoved).toBe(true);

    // Verify component B positions unchanged
    const origB = graph.nodes.find((n) => n.id === componentBId);
    const resultB = result.nodes.find((n) => n.id === componentBId);
    expect(resultB?.position).toEqual(origB?.position);

    expect(elapsed).toBeLessThan(200);
  });
});
