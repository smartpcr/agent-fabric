import { describe, it, expect, vi } from "vitest";
import { computeAffectedSubgraph, incrementalLayout } from "@/domain/layout/incrementalLayout";
import {
  makeGraph,
  addNodeToGraph,
  addEdgeToGraph,
  type WorkflowGraph,
} from "@/domain/models/graph";
import { makeNode, type WorkflowNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";

vi.mock("@/domain/layout/layoutGraph", () => ({
  layoutGraph: vi.fn((graph: WorkflowGraph) =>
    Promise.resolve({
      ...graph,
      nodes: graph.nodes.map((n: WorkflowNode) => ({
        ...n,
        position: { x: n.position.x + 1, y: n.position.y + 1 },
      })),
    }),
  ),
}));

/**
 * Build a chain graph: n0 -> n1 -> n2 -> ... -> n(count-1).
 * Every node is connected linearly, so every node is in the same component.
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

  it("incrementalLayout on 100-node chain completes under 200ms", async () => {
    const { graph, firstId } = buildChainGraph(100);
    const stubRegistry = { get: () => undefined };

    const start = performance.now();
    const result = await incrementalLayout(graph, firstId, stubRegistry);
    const elapsed = performance.now() - start;

    expect(result.nodes).toHaveLength(100);
    expect(elapsed).toBeLessThan(200);
  });

  it("incrementalLayout on half-component (50 of 100 nodes) completes under 200ms", async () => {
    const { graph, componentAId } = buildTwoComponentGraph(50);
    const stubRegistry = { get: () => undefined };

    const start = performance.now();
    const result = await incrementalLayout(graph, componentAId, stubRegistry);
    const elapsed = performance.now() - start;

    // All 100 nodes returned, but only 50 should have moved
    expect(result.nodes).toHaveLength(100);
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
