/**
 * Test fixture: decision node graph with both if-else and switch variants.
 * Builds a graph: start → decision(if-else) → [true→end1, false→switch] → [branches→end2/end3, default→end4]
 */
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";

export function buildDecisionFixtureGraph() {
  const start = makeNode({ kind: "start", data: {} });
  const decision = makeNode({
    kind: "decision",
    data: { condition: "status === 'active'" },
  });
  const sw = makeNode({
    kind: "decision-switch",
    data: {
      branches: [
        { label: "Case A", condition: "role === 'admin'" },
        { label: "Case B", condition: "role === 'user'" },
      ],
    },
  });
  const endTrue = makeNode({ kind: "end", data: {} });
  const endCaseA = makeNode({ kind: "end", data: {} });
  const endCaseB = makeNode({ kind: "end", data: {} });
  const endDefault = makeNode({ kind: "end", data: {} });

  let g = makeGraph("Decision Fixture");
  g = addNodeToGraph(g, start);
  g = addNodeToGraph(g, decision);
  g = addNodeToGraph(g, sw);
  g = addNodeToGraph(g, endTrue);
  g = addNodeToGraph(g, endCaseA);
  g = addNodeToGraph(g, endCaseB);
  g = addNodeToGraph(g, endDefault);

  // start → decision
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: start.id,
      sourcePort: "out",
      target: decision.id,
      targetPort: "in",
    }),
  );

  // decision true → endTrue
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: decision.id,
      sourcePort: "true",
      target: endTrue.id,
      targetPort: "in",
      kind: "conditional",
      condition: "status === 'active'",
      label: "true",
    }),
  );

  // decision false → switch
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: decision.id,
      sourcePort: "false",
      target: sw.id,
      targetPort: "in",
      kind: "conditional",
      condition: "!(status === 'active')",
      label: "false",
    }),
  );

  // switch Case A → endCaseA
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: sw.id,
      sourcePort: "branch-case-a",
      target: endCaseA.id,
      targetPort: "in",
      kind: "conditional",
      condition: "role === 'admin'",
      label: "Case A",
    }),
  );

  // switch Case B → endCaseB
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: sw.id,
      sourcePort: "branch-case-b",
      target: endCaseB.id,
      targetPort: "in",
      kind: "conditional",
      condition: "role === 'user'",
      label: "Case B",
    }),
  );

  // switch default → endDefault
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: sw.id,
      sourcePort: "default",
      target: endDefault.id,
      targetPort: "in",
      kind: "conditional",
      label: "default",
    }),
  );

  return { graph: g, start, decision, sw, endTrue, endCaseA, endCaseB, endDefault };
}
