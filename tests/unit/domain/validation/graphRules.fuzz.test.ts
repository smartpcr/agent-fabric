import { describe, it } from "vitest";
import fc from "fast-check";
import { z } from "zod";
import type { WorkflowGraph } from "@/domain/models/graph";
import type { WorkflowNode } from "@/domain/models/node";
import type { WorkflowEdge } from "@/domain/models/edge";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { validateConnection, type NodeSpecRegistry } from "@/domain/validation/connectionRules";
import { validateGraph } from "@/domain/validation/graphRules";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

const emptySchema = z.object({});

const startSpec: NodeSpec = {
  kind: "start",
  category: "control",
  label: "Start",
  icon: "play",
  ports: [makeOutputPort({ id: "out", label: "Out", dataType: "any", cardinality: "multi" })],
  propertySchema: emptySchema,
  defaultData: {},
  capabilities: [],
};

const endSpec: NodeSpec = {
  kind: "end",
  category: "control",
  label: "End",
  icon: "stop",
  ports: [makeInputPort({ id: "in", label: "In", dataType: "any", cardinality: "multi" })],
  propertySchema: emptySchema,
  defaultData: {},
  capabilities: [],
};

const taskSpec: NodeSpec = {
  kind: "task",
  category: "action",
  label: "Task",
  icon: "box",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any", cardinality: "multi" }),
    makeOutputPort({ id: "out", label: "Out", dataType: "any", cardinality: "multi" }),
  ],
  propertySchema: emptySchema,
  defaultData: {},
  capabilities: [],
};

const specs = [startSpec, endSpec, taskSpec];

function makeRegistry(): NodeSpecRegistry {
  const map = new Map(specs.map((s) => [s.kind, s]));
  return { get: (kind: string) => map.get(kind) };
}

const registry = makeRegistry();

function makeNodeId(index: number): string {
  return `node-${String(index)}`;
}

function makeEdgeId(index: number): string {
  return `edge-${String(index)}`;
}

interface GeneratedGraph {
  graph: WorkflowGraph;
  nodeCount: number;
}

function arbitraryGraph(maxNodes: number): fc.Arbitrary<GeneratedGraph> {
  return fc
    .record({
      middleCount: fc.integer({ min: 0, max: maxNodes - 2 }),
      seed: fc.integer({ min: 0, max: 1_000_000 }),
    })
    .chain(({ middleCount }) => {
      const nodeCount = middleCount + 2;
      const edgeArb = fc.array(
        fc.record({
          srcIdx: fc.integer({ min: 0, max: nodeCount - 1 }),
          tgtIdx: fc.integer({ min: 0, max: nodeCount - 1 }),
        }),
        { minLength: nodeCount - 1, maxLength: nodeCount * 2 },
      );
      return edgeArb.map((rawEdges) => buildGraph(nodeCount, rawEdges));
    });
}

function buildGraph(
  nodeCount: number,
  rawEdges: readonly { srcIdx: number; tgtIdx: number }[],
): GeneratedGraph {
  const nodes: WorkflowNode[] = [];

  // Node 0 is always "start", last node is "end", others are "task"
  for (let i = 0; i < nodeCount; i++) {
    let kind: string;
    if (i === 0) {
      kind = "start";
    } else if (i === nodeCount - 1) {
      kind = "end";
    } else {
      kind = "task";
    }
    nodes.push({
      id: makeNodeId(i),
      kind,
      position: { x: i * 100, y: 0 },
      data: {},
    });
  }

  const edges: WorkflowEdge[] = [];
  let edgeIdx = 0;

  // Build a chain start → task1 → task2 → ... → end to ensure connectivity
  for (let i = 0; i < nodeCount - 1; i++) {
    const srcNode = nodes[i];
    const tgtNode = nodes[i + 1];
    const srcSpec = registry.get(srcNode.kind);
    const tgtSpec = registry.get(tgtNode.kind);
    const srcPort = srcSpec?.ports.find((p) => p.kind === "out");
    const tgtPort = tgtSpec?.ports.find((p) => p.kind === "in");
    if (srcPort && tgtPort) {
      edges.push({
        id: makeEdgeId(edgeIdx),
        source: srcNode.id,
        sourcePort: srcPort.id,
        target: tgtNode.id,
        targetPort: tgtPort.id,
        kind: "default",
      });
      edgeIdx += 1;
    }
  }

  // Add random edges (only valid output→input, skipping self-loops)
  for (const raw of rawEdges) {
    const srcNode = nodes[raw.srcIdx];
    const tgtNode = nodes[raw.tgtIdx];
    if (srcNode.id === tgtNode.id) {
      continue;
    }
    const srcSpec = registry.get(srcNode.kind);
    const tgtSpec = registry.get(tgtNode.kind);
    const srcPort = srcSpec?.ports.find((p) => p.kind === "out");
    const tgtPort = tgtSpec?.ports.find((p) => p.kind === "in");
    if (!srcPort || !tgtPort) {
      continue;
    }
    // Skip duplicates
    const alreadyExists = edges.some(
      (e) =>
        e.source === srcNode.id &&
        e.sourcePort === srcPort.id &&
        e.target === tgtNode.id &&
        e.targetPort === tgtPort.id,
    );
    if (alreadyExists) {
      continue;
    }
    edges.push({
      id: makeEdgeId(edgeIdx),
      source: srcNode.id,
      sourcePort: srcPort.id,
      target: tgtNode.id,
      targetPort: tgtPort.id,
      kind: "default",
    });
    edgeIdx += 1;
  }

  const graph: WorkflowGraph = Object.freeze({
    schemaVersion: 1,
    id: "fuzz-graph",
    name: "fuzz",
    nodes: Object.freeze(nodes.map((n) => Object.freeze(n))),
    edges: Object.freeze(edges.map((e) => Object.freeze(e))),
  });

  return { graph, nodeCount };
}

describe("graphRules property-based fuzz tests", () => {
  it("a valid graph remains valid after adding any valid edge", { timeout: 10_000 }, () => {
    fc.assert(
      fc.property(arbitraryGraph(30), ({ graph, nodeCount }) => {
        const baseline = validateGraph(graph, registry);
        if (!baseline.ok) {
          return true; // skip invalid graphs
        }

        // Try adding every possible valid edge
        for (let si = 0; si < nodeCount; si++) {
          for (let ti = 0; ti < nodeCount; ti++) {
            if (si === ti) {
              continue;
            }
            const srcNode = graph.nodes[si];
            const tgtNode = graph.nodes[ti];
            if (!srcNode || !tgtNode) {
              continue;
            }
            const srcSpec = registry.get(srcNode.kind);
            const tgtSpec = registry.get(tgtNode.kind);
            const srcPort = srcSpec?.ports.find((p) => p.kind === "out");
            const tgtPort = tgtSpec?.ports.find((p) => p.kind === "in");
            if (!srcPort || !tgtPort) {
              continue;
            }

            // Check if the connection is valid
            const connResult = validateConnection(
              graph,
              { nodeId: srcNode.id, portId: srcPort.id },
              { nodeId: tgtNode.id, portId: tgtPort.id },
              registry,
            );
            if (!connResult.ok) {
              continue;
            }

            // Add the edge and re-validate
            const newEdge: WorkflowEdge = Object.freeze({
              id: `fuzz-edge-${String(si)}-${String(ti)}`,
              source: srcNode.id,
              sourcePort: srcPort.id,
              target: tgtNode.id,
              targetPort: tgtPort.id,
              kind: "default" as const,
            });
            const extendedGraph: WorkflowGraph = Object.freeze({
              ...graph,
              edges: Object.freeze([...graph.edges, newEdge]),
            });

            const afterResult = validateGraph(extendedGraph, registry);
            if (!afterResult.ok) {
              return false;
            }
          }
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });
});
