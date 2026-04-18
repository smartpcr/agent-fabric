import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toElkGraph } from "@/domain/layout/elkAdapter";
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";

const emptySchema = z.object({});

function spec(
  kind: string,
  ports: NodeSpec["ports"],
  opts: { capabilities?: readonly string[] } = {},
): NodeSpec {
  return {
    kind,
    category: "test",
    label: kind,
    icon: "box",
    ports,
    propertySchema: emptySchema,
    defaultData: {},
    capabilities: opts.capabilities ?? [],
  };
}

const startSpec = spec("start", [makeOutputPort({ id: "out", label: "Out", dataType: "any" })]);
const endSpec = spec("end", [makeInputPort({ id: "in", label: "In", dataType: "any" })]);
const taskSpec = spec("task", [
  makeInputPort({ id: "in", label: "In", dataType: "any" }),
  makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
]);
const loopWhileSpec = spec(
  "loop-while",
  [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "body-out", label: "Body Out", dataType: "any" }),
    makeInputPort({ id: "body-in", label: "Body In", dataType: "any" }),
    makeOutputPort({ id: "done", label: "Done", dataType: "any" }),
  ],
  { capabilities: ["canHaveBackEdge"] },
);

function makeRegistry(specs: NodeSpec[]): NodeSpecRegistry {
  const map = new Map(specs.map((s) => [s.kind, s]));
  return { get: (kind: string) => map.get(kind) };
}

const registry = makeRegistry([startSpec, endSpec, taskSpec, loopWhileSpec]);

describe("toElkGraph", () => {
  describe("empty graph", () => {
    it("returns a root node with no children or edges", () => {
      const g = makeGraph("Empty");
      const elk = toElkGraph(g, registry);

      expect(elk.id).toBe(g.id);
      expect(elk.children).toEqual([]);
      expect(elk.edges).toEqual([]);
    });
  });

  describe("nodes → ELK children", () => {
    it("maps each workflow node to an ELK child with correct id", () => {
      const start = makeNode({ kind: "start", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Two Nodes");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, end);

      const elk = toElkGraph(g, registry);

      expect(elk.children).toHaveLength(2);
      expect(elk.children?.map((c) => c.id)).toEqual([start.id, end.id]);
    });

    it("uses default dimensions when node has no width/height", () => {
      const start = makeNode({ kind: "start", data: {} });
      let g = makeGraph("Default Size");
      g = addNodeToGraph(g, start);

      const elk = toElkGraph(g, registry);
      const child = elk.children?.[0];

      expect(child?.width).toBe(180);
      expect(child?.height).toBe(60);
    });

    it("uses node dimensions when present", () => {
      const node = Object.freeze({
        ...makeNode({ kind: "task", data: {} }),
        width: 300,
        height: 120,
      });
      let g = makeGraph("Custom Size");
      g = addNodeToGraph(g, node);

      const elk = toElkGraph(g, registry);
      const child = elk.children?.[0];

      expect(child?.width).toBe(300);
      expect(child?.height).toBe(120);
    });

    it("sets label from registry spec", () => {
      const start = makeNode({ kind: "start", data: {} });
      let g = makeGraph("Labels");
      g = addNodeToGraph(g, start);

      const elk = toElkGraph(g, registry);
      const child = elk.children?.[0];

      expect(child?.labels).toEqual([{ text: "start" }]);
    });

    it("falls back to node kind when spec is not in registry", () => {
      const unknown = makeNode({ kind: "unknown-kind", data: {} });
      let g = makeGraph("Unknown");
      g = addNodeToGraph(g, unknown);

      const elk = toElkGraph(g, registry);
      const child = elk.children?.[0];

      expect(child?.labels).toEqual([{ text: "unknown-kind" }]);
    });

    it("sets portConstraints to FIXED_SIDE", () => {
      const task = makeNode({ kind: "task", data: {} });
      let g = makeGraph("Port Constraints");
      g = addNodeToGraph(g, task);

      const elk = toElkGraph(g, registry);
      const child = elk.children?.[0];

      expect(child?.layoutOptions?.["org.eclipse.elk.portConstraints"]).toBe("FIXED_SIDE");
    });
  });

  describe("ports → ELK ports", () => {
    it("creates ELK ports with composite node.port ids", () => {
      const task = makeNode({ kind: "task", data: {} });
      let g = makeGraph("Ports");
      g = addNodeToGraph(g, task);

      const elk = toElkGraph(g, registry);
      const ports = elk.children?.[0]?.ports ?? [];

      expect(ports).toHaveLength(2);
      expect(ports.map((p) => p.id)).toEqual([`${task.id}.in`, `${task.id}.out`]);
    });

    it("sets port side based on port kind (in → WEST, out → EAST)", () => {
      const task = makeNode({ kind: "task", data: {} });
      let g = makeGraph("Port Sides");
      g = addNodeToGraph(g, task);

      const elk = toElkGraph(g, registry);
      const ports = elk.children?.[0]?.ports ?? [];

      const inPort = ports.find((p) => p.id.endsWith(".in"));
      const outPort = ports.find((p) => p.id.endsWith(".out"));

      expect(inPort?.layoutOptions?.["org.eclipse.elk.port.side"]).toBe("WEST");
      expect(outPort?.layoutOptions?.["org.eclipse.elk.port.side"]).toBe("EAST");
    });

    it("sets port labels from spec", () => {
      const task = makeNode({ kind: "task", data: {} });
      let g = makeGraph("Port Labels");
      g = addNodeToGraph(g, task);

      const elk = toElkGraph(g, registry);
      const ports = elk.children?.[0]?.ports ?? [];

      expect(ports[0].labels).toEqual([{ text: "In" }]);
      expect(ports[1].labels).toEqual([{ text: "Out" }]);
    });

    it("maps all ports for a loop-while node", () => {
      const loop = makeNode({ kind: "loop-while", data: { condition: "x" } });
      let g = makeGraph("Loop Ports");
      g = addNodeToGraph(g, loop);

      const elk = toElkGraph(g, registry);
      const ports = elk.children?.[0]?.ports ?? [];

      expect(ports).toHaveLength(4);
      expect(ports.map((p) => p.id)).toEqual([
        `${loop.id}.in`,
        `${loop.id}.body-out`,
        `${loop.id}.body-in`,
        `${loop.id}.done`,
      ]);
    });

    it("produces empty ports array when spec is not found", () => {
      const unknown = makeNode({ kind: "unknown-kind", data: {} });
      let g = makeGraph("No Spec");
      g = addNodeToGraph(g, unknown);

      const elk = toElkGraph(g, registry);
      const ports = elk.children?.[0]?.ports ?? [];

      expect(ports).toEqual([]);
    });
  });

  describe("edges → ELK extended edges", () => {
    it("maps edges with composite source/target port ids", () => {
      const start = makeNode({ kind: "start", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Edge");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, end);
      const edge = makeEdge({
        source: start.id,
        sourcePort: "out",
        target: end.id,
        targetPort: "in",
      });
      g = addEdgeToGraph(g, edge);

      const elk = toElkGraph(g, registry);

      expect(elk.edges).toHaveLength(1);
      const elkEdge = elk.edges?.[0];
      expect(elkEdge?.id).toBe(edge.id);
      expect(elkEdge?.sources).toEqual([`${start.id}.out`]);
      expect(elkEdge?.targets).toEqual([`${end.id}.in`]);
    });

    it("includes edge label when present", () => {
      const start = makeNode({ kind: "start", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Labeled Edge");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, end);
      const edge = makeEdge({
        source: start.id,
        sourcePort: "out",
        target: end.id,
        targetPort: "in",
        label: "next",
      });
      g = addEdgeToGraph(g, edge);

      const elk = toElkGraph(g, registry);
      const elkEdge = elk.edges?.[0];

      expect(elkEdge?.labels).toEqual([{ text: "next" }]);
    });

    it("produces empty labels array when edge has no label", () => {
      const start = makeNode({ kind: "start", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("No Label");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, end);
      const edge = makeEdge({
        source: start.id,
        sourcePort: "out",
        target: end.id,
        targetPort: "in",
      });
      g = addEdgeToGraph(g, edge);

      const elk = toElkGraph(g, registry);
      const elkEdge = elk.edges?.[0];

      expect(elkEdge?.labels).toEqual([]);
    });

    it("maps loop-back edges correctly", () => {
      const loop = makeNode({ kind: "loop-while", data: { condition: "x" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Loop Back");
      g = addNodeToGraph(g, loop);
      g = addNodeToGraph(g, end);
      const backEdge = makeEdge({
        source: loop.id,
        sourcePort: "body-out",
        target: loop.id,
        targetPort: "body-in",
        kind: "loop-back",
      });
      g = addEdgeToGraph(g, backEdge);

      const elk = toElkGraph(g, registry);
      const elkEdge = elk.edges?.[0];

      expect(elkEdge?.sources).toEqual([`${loop.id}.body-out`]);
      expect(elkEdge?.targets).toEqual([`${loop.id}.body-in`]);
    });

    it("maps multiple edges", () => {
      const start = makeNode({ kind: "start", data: {} });
      const task = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Multi Edge");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, task);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: start.id,
          sourcePort: "out",
          target: task.id,
          targetPort: "in",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: task.id,
          sourcePort: "out",
          target: end.id,
          targetPort: "in",
        }),
      );

      const elk = toElkGraph(g, registry);

      expect(elk.edges).toHaveLength(2);
    });
  });

  describe("roundtrip safety", () => {
    it("preserves node ids through transformation", () => {
      const start = makeNode({ kind: "start", data: {} });
      const task = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Roundtrip");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, task);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: start.id,
          sourcePort: "out",
          target: task.id,
          targetPort: "in",
        }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: task.id,
          sourcePort: "out",
          target: end.id,
          targetPort: "in",
        }),
      );

      const elk = toElkGraph(g, registry);

      // Every original node id is present as an ELK child id
      const childIds = new Set(elk.children?.map((c) => c.id));
      for (const node of g.nodes) {
        expect(childIds.has(node.id)).toBe(true);
      }

      // Every original edge id is present as an ELK edge id
      const edgeIds = new Set(elk.edges?.map((e) => e.id));
      for (const edge of g.edges) {
        expect(edgeIds.has(edge.id)).toBe(true);
      }
    });

    it("graph id is used as root ELK node id", () => {
      const g = makeGraph("Root ID");
      const elk = toElkGraph(g, registry);

      expect(elk.id).toBe(g.id);
    });

    it("port ids can be decomposed back to node.port pairs", () => {
      const task = makeNode({ kind: "task", data: {} });
      let g = makeGraph("Port Decompose");
      g = addNodeToGraph(g, task);

      const elk = toElkGraph(g, registry);
      const ports = elk.children?.[0]?.ports ?? [];

      for (const port of ports) {
        const parts = port.id.split(".");
        expect(parts).toHaveLength(2);
        expect(parts[0]).toBe(task.id);
        expect(["in", "out"]).toContain(parts[1]);
      }
    });

    it("edge source/target references match existing port ids", () => {
      const start = makeNode({ kind: "start", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("Ref Check");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: start.id,
          sourcePort: "out",
          target: end.id,
          targetPort: "in",
        }),
      );

      const elk = toElkGraph(g, registry);

      const allPortIds = new Set(
        (elk.children ?? []).flatMap((c) => (c.ports ?? []).map((p) => p.id)),
      );

      for (const edge of elk.edges ?? []) {
        for (const src of edge.sources) {
          expect(allPortIds.has(src)).toBe(true);
        }
        for (const tgt of edge.targets) {
          expect(allPortIds.has(tgt)).toBe(true);
        }
      }
    });
  });
});
