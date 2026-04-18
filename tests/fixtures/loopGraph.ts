/**
 * Test fixtures: loop node graphs for integration testing.
 *
 * - buildWhileLoopGraph: start → loop-while (body: task) → end
 * - buildNestedLoopGraph: start → loop-foreach (body: loop-while (body: task)) → end
 */
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";

/**
 * Simple while-loop:
 *   start → whileLoop → (body-out → task → body-in [back-edge]) → done → end
 */
export function buildWhileLoopGraph() {
  const start = makeNode({ kind: "start", data: {} });
  const whileLoop = makeNode({
    kind: "loop-while",
    data: { condition: "count < 10" },
  });
  const task = makeNode({ kind: "task", data: { name: "Process", params: {} } });
  const end = makeNode({ kind: "end", data: {} });

  let g = makeGraph("While Loop Fixture");
  g = addNodeToGraph(g, start);
  g = addNodeToGraph(g, whileLoop);
  g = addNodeToGraph(g, task);
  g = addNodeToGraph(g, end);

  // start → whileLoop
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: start.id,
      sourcePort: "out",
      target: whileLoop.id,
      targetPort: "in",
    }),
  );

  // whileLoop body-out → task
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: whileLoop.id,
      sourcePort: "body-out",
      target: task.id,
      targetPort: "in",
    }),
  );

  // task out → whileLoop body-in (via back-edge from the loop itself)
  // The back-edge must be self-referencing: source = loop, target = loop, targetPort = body-in
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: whileLoop.id,
      sourcePort: "body-out",
      target: whileLoop.id,
      targetPort: "body-in",
      kind: "loop-back",
    }),
  );

  // whileLoop done → end
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: whileLoop.id,
      sourcePort: "done",
      target: end.id,
      targetPort: "in",
    }),
  );

  return { graph: g, start, whileLoop, task, end };
}

/**
 * Nested loops: for-each containing a while-loop.
 *
 *   start → forEachLoop → (body-out → whileLoop → (body-out → innerTask → body-in [back]) → done → forEachLoop body-in [back]) → done → end
 *
 * The for-each iterates over a collection; inside its body a while-loop
 * processes each item until a condition is met.
 */
export function buildNestedLoopGraph() {
  const start = makeNode({ kind: "start", data: {} });
  const forEachLoop = makeNode({
    kind: "loop-foreach",
    data: { iterable: "users", item: "user" },
  });
  const whileLoop = makeNode({
    kind: "loop-while",
    data: { condition: "retries < 3" },
  });
  const innerTask = makeNode({
    kind: "task",
    data: { name: "SendEmail", params: {} },
  });
  const end = makeNode({ kind: "end", data: {} });

  let g = makeGraph("Nested Loop Fixture");
  g = addNodeToGraph(g, start);
  g = addNodeToGraph(g, forEachLoop);
  g = addNodeToGraph(g, whileLoop);
  g = addNodeToGraph(g, innerTask);
  g = addNodeToGraph(g, end);

  // start → forEachLoop
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: start.id,
      sourcePort: "out",
      target: forEachLoop.id,
      targetPort: "in",
    }),
  );

  // forEachLoop body-out → whileLoop in
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: forEachLoop.id,
      sourcePort: "body-out",
      target: whileLoop.id,
      targetPort: "in",
    }),
  );

  // whileLoop body-out → innerTask
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: whileLoop.id,
      sourcePort: "body-out",
      target: innerTask.id,
      targetPort: "in",
    }),
  );

  // whileLoop back-edge (self-loop on body-in)
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: whileLoop.id,
      sourcePort: "body-out",
      target: whileLoop.id,
      targetPort: "body-in",
      kind: "loop-back",
    }),
  );

  // whileLoop done → forEachLoop body-in  (feeds back into outer loop)
  // This is NOT a back-edge — it's a normal flow edge from inner done to outer body-in
  // The outer loop's back-edge is separate
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: whileLoop.id,
      sourcePort: "done",
      target: forEachLoop.id,
      targetPort: "body-in",
    }),
  );

  // forEachLoop back-edge (self-loop on body-in)
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: forEachLoop.id,
      sourcePort: "body-out",
      target: forEachLoop.id,
      targetPort: "body-in",
      kind: "loop-back",
    }),
  );

  // forEachLoop done → end
  g = addEdgeToGraph(
    g,
    makeEdge({
      source: forEachLoop.id,
      sourcePort: "done",
      target: end.id,
      targetPort: "in",
    }),
  );

  return { graph: g, start, forEachLoop, whileLoop, innerTask, end };
}
