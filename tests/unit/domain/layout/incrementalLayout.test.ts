import { describe, it, expect, vi } from "vitest";
import {
  computeAffectedSubgraph,
  mergeSubgraphPositions,
  incrementalLayout,
} from "@/domain/layout/incrementalLayout";
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
        position: { x: n.position.x + 50, y: n.position.y + 50 },
      })),
    }),
  ),
}));

function buildLinearGraph(): {
  graph: WorkflowGraph;
  ids: { a: string; b: string; c: string };
} {
  const a = makeNode({ kind: "task", data: {}, position: { x: 0, y: 0 } });
  const b = makeNode({ kind: "task", data: {}, position: { x: 100, y: 0 } });
  const c = makeNode({ kind: "task", data: {}, position: { x: 200, y: 0 } });

  let graph = makeGraph("linear");
  graph = addNodeToGraph(graph, a);
  graph = addNodeToGraph(graph, b);
  graph = addNodeToGraph(graph, c);

  const ab = makeEdge({
    source: a.id,
    sourcePort: "out",
    target: b.id,
    targetPort: "in",
  });
  const bc = makeEdge({
    source: b.id,
    sourcePort: "out",
    target: c.id,
    targetPort: "in",
  });
  graph = addEdgeToGraph(graph, ab);
  graph = addEdgeToGraph(graph, bc);

  return { graph, ids: { a: a.id, b: b.id, c: c.id } };
}

function buildDisconnectedGraph(): {
  graph: WorkflowGraph;
  ids: { a: string; b: string; c: string; d: string };
} {
  const a = makeNode({ kind: "task", data: {}, position: { x: 0, y: 0 } });
  const b = makeNode({ kind: "task", data: {}, position: { x: 100, y: 0 } });
  const c = makeNode({ kind: "task", data: {}, position: { x: 200, y: 0 } });
  const d = makeNode({ kind: "task", data: {}, position: { x: 300, y: 0 } });

  let graph = makeGraph("disconnected");
  graph = addNodeToGraph(graph, a);
  graph = addNodeToGraph(graph, b);
  graph = addNodeToGraph(graph, c);
  graph = addNodeToGraph(graph, d);

  // A -> B (component 1)
  const ab = makeEdge({
    source: a.id,
    sourcePort: "out",
    target: b.id,
    targetPort: "in",
  });
  // C -> D (component 2)
  const cd = makeEdge({
    source: c.id,
    sourcePort: "out",
    target: d.id,
    targetPort: "in",
  });
  graph = addEdgeToGraph(graph, ab);
  graph = addEdgeToGraph(graph, cd);

  return { graph, ids: { a: a.id, b: b.id, c: c.id, d: d.id } };
}

describe("computeAffectedSubgraph", () => {
  it("returns all connected nodes for a fully-connected linear graph", () => {
    const { graph, ids } = buildLinearGraph();
    const sub = computeAffectedSubgraph(graph, ids.a);
    expect(sub.nodes).toHaveLength(3);
    expect(sub.edges).toHaveLength(2);
  });

  it("returns same result regardless of starting node in connected graph", () => {
    const { graph, ids } = buildLinearGraph();
    const fromA = computeAffectedSubgraph(graph, ids.a);
    const fromC = computeAffectedSubgraph(graph, ids.c);
    expect(fromA.nodes).toHaveLength(fromC.nodes.length);
    expect(fromA.edges).toHaveLength(fromC.edges.length);
  });

  it("returns only connected component for disconnected graph", () => {
    const { graph, ids } = buildDisconnectedGraph();
    const sub = computeAffectedSubgraph(graph, ids.a);
    expect(sub.nodes).toHaveLength(2);
    expect(sub.edges).toHaveLength(1);

    const nodeIds = sub.nodes.map((n) => n.id);
    expect(nodeIds).toContain(ids.a);
    expect(nodeIds).toContain(ids.b);
    expect(nodeIds).not.toContain(ids.c);
    expect(nodeIds).not.toContain(ids.d);
  });

  it("returns other component when starting from node in second component", () => {
    const { graph, ids } = buildDisconnectedGraph();
    const sub = computeAffectedSubgraph(graph, ids.c);
    expect(sub.nodes).toHaveLength(2);

    const nodeIds = sub.nodes.map((n) => n.id);
    expect(nodeIds).toContain(ids.c);
    expect(nodeIds).toContain(ids.d);
    expect(nodeIds).not.toContain(ids.a);
  });

  it("returns single node when it has no edges", () => {
    const lone = makeNode({ kind: "task", data: {}, position: { x: 0, y: 0 } });
    let graph = makeGraph("lone");
    graph = addNodeToGraph(graph, lone);

    const sub = computeAffectedSubgraph(graph, lone.id);
    expect(sub.nodes).toHaveLength(1);
    expect(sub.edges).toHaveLength(0);
  });

  it("handles empty graph gracefully", () => {
    const graph = makeGraph("empty");
    const sub = computeAffectedSubgraph(graph, "nonexistent");
    expect(sub.nodes).toHaveLength(0);
    expect(sub.edges).toHaveLength(0);
  });

  it("follows edges in both directions (upstream + downstream)", () => {
    const { graph, ids } = buildLinearGraph();
    // Starting from middle node should include both A and C
    const sub = computeAffectedSubgraph(graph, ids.b);
    expect(sub.nodes).toHaveLength(3);

    const nodeIds = sub.nodes.map((n) => n.id);
    expect(nodeIds).toContain(ids.a);
    expect(nodeIds).toContain(ids.b);
    expect(nodeIds).toContain(ids.c);
  });

  it("preserves edge data in subgraph", () => {
    const { graph, ids } = buildLinearGraph();
    const sub = computeAffectedSubgraph(graph, ids.a);
    for (const edge of sub.edges) {
      expect(edge.source).toBeDefined();
      expect(edge.target).toBeDefined();
      expect(edge.sourcePort).toBeDefined();
      expect(edge.targetPort).toBeDefined();
    }
  });
});

describe("mergeSubgraphPositions", () => {
  it("updates positions for nodes in the subgraph result", () => {
    const { graph, ids } = buildDisconnectedGraph();

    // Simulate layout result for component 1 only
    const layoutResult: WorkflowGraph = {
      schemaVersion: 1,
      id: "sub",
      name: "sub",
      nodes: [
        { ...graph.nodes[0], position: { x: 500, y: 600 } },
        { ...graph.nodes[1], position: { x: 700, y: 800 } },
      ],
      edges: [],
    };

    const merged = mergeSubgraphPositions(graph, layoutResult);
    expect(merged.nodes).toHaveLength(4);

    // Component 1 should have updated positions
    const nodeA = merged.nodes.find((n) => n.id === ids.a);
    const nodeB = merged.nodes.find((n) => n.id === ids.b);
    expect(nodeA?.position).toEqual({ x: 500, y: 600 });
    expect(nodeB?.position).toEqual({ x: 700, y: 800 });

    // Component 2 should keep original positions
    const nodeC = merged.nodes.find((n) => n.id === ids.c);
    const nodeD = merged.nodes.find((n) => n.id === ids.d);
    expect(nodeC?.position).toEqual({ x: 200, y: 0 });
    expect(nodeD?.position).toEqual({ x: 300, y: 0 });
  });

  it("returns original graph when layout result has no matching nodes", () => {
    const { graph } = buildLinearGraph();

    const layoutResult: WorkflowGraph = {
      schemaVersion: 1,
      id: "sub",
      name: "sub",
      nodes: [],
      edges: [],
    };

    const merged = mergeSubgraphPositions(graph, layoutResult);
    for (let i = 0; i < graph.nodes.length; i++) {
      expect(merged.nodes[i].position).toEqual(graph.nodes[i].position);
    }
  });

  it("preserves edges from the full graph", () => {
    const { graph, ids } = buildDisconnectedGraph();

    const layoutResult: WorkflowGraph = {
      schemaVersion: 1,
      id: "sub",
      name: "sub",
      nodes: [{ ...graph.nodes[0], position: { x: 999, y: 999 } }],
      edges: [],
    };

    const merged = mergeSubgraphPositions(graph, layoutResult);
    expect(merged.edges).toHaveLength(graph.edges.length);

    const nodeA = merged.nodes.find((n) => n.id === ids.a);
    expect(nodeA?.position).toEqual({ x: 999, y: 999 });
  });
});

describe("incrementalLayout", () => {
  it("layouts only the affected subgraph for disconnected components", async () => {
    const { layoutGraph } = await import("@/domain/layout/layoutGraph");
    const mockFn = vi.mocked(layoutGraph);
    mockFn.mockClear();

    const { graph, ids } = buildDisconnectedGraph();

    const stubRegistry = { get: () => undefined };
    const result = await incrementalLayout(graph, ids.a, stubRegistry);

    expect(mockFn).toHaveBeenCalledOnce();
    const calledGraph = mockFn.mock.calls[0]?.[0] as WorkflowGraph;
    expect(calledGraph.nodes).toHaveLength(2);

    // Component 1 positions should be updated (mock adds +50)
    const nodeA = result.nodes.find((n) => n.id === ids.a);
    const nodeB = result.nodes.find((n) => n.id === ids.b);
    expect(nodeA?.position.x).toBe(50);
    expect(nodeB?.position.x).toBe(150);

    // Component 2 positions should be unchanged
    const nodeC = result.nodes.find((n) => n.id === ids.c);
    const nodeD = result.nodes.find((n) => n.id === ids.d);
    expect(nodeC?.position).toEqual({ x: 200, y: 0 });
    expect(nodeD?.position).toEqual({ x: 300, y: 0 });
  });

  it("layouts the full graph when all nodes are connected", async () => {
    const { layoutGraph } = await import("@/domain/layout/layoutGraph");
    const mockFn = vi.mocked(layoutGraph);
    mockFn.mockClear();

    const { graph, ids } = buildLinearGraph();

    const stubRegistry = { get: () => undefined };
    const result = await incrementalLayout(graph, ids.a, stubRegistry);

    expect(mockFn).toHaveBeenCalledOnce();
    const calledGraph = mockFn.mock.calls[0]?.[0] as WorkflowGraph;
    expect(calledGraph.nodes).toHaveLength(3);

    // All positions updated
    for (const node of result.nodes) {
      const orig = graph.nodes.find((n) => n.id === node.id);
      expect(node.position.x).toBe((orig?.position.x ?? 0) + 50);
      expect(node.position.y).toBe((orig?.position.y ?? 0) + 50);
    }
  });

  it("passes strategy to layoutGraph", async () => {
    const { layoutGraph } = await import("@/domain/layout/layoutGraph");
    const mockFn = vi.mocked(layoutGraph);
    mockFn.mockClear();

    const { graph, ids } = buildLinearGraph();
    const stubRegistry = { get: () => undefined };

    await incrementalLayout(graph, ids.a, stubRegistry, "force");

    expect(mockFn).toHaveBeenCalledOnce();
    expect(mockFn.mock.calls[0]?.[2]).toBe("force");
  });
});
