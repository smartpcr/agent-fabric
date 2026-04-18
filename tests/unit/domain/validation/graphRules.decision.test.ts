import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateGraph, type GraphValidationError } from "@/domain/validation/graphRules";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";
import { makeGraph, addNodeToGraph, addEdgeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeEdge } from "@/domain/models/edge";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const emptySchema = z.object({});

function spec(
  kind: string,
  ports: NodeSpec["ports"],
  opts: { variant?: string; capabilities?: readonly string[] } = {},
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
    ...(opts.variant ? { variant: opts.variant } : {}),
  };
}

const startSpec = spec("start", [makeOutputPort({ id: "out", label: "Out", dataType: "any" })]);
const endSpec = spec("end", [makeInputPort({ id: "in", label: "In", dataType: "any" })]);

const decisionIfElseSpec = spec(
  "decision",
  [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "true", label: "True", dataType: "any" }),
    makeOutputPort({ id: "false", label: "False", dataType: "any" }),
  ],
  { variant: "if-else" },
);

const decisionSwitchSpec = spec(
  "decision-switch",
  [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "branch-case-a", label: "Case A", dataType: "any" }),
    makeOutputPort({ id: "branch-case-b", label: "Case B", dataType: "any" }),
    makeOutputPort({ id: "default", label: "default", dataType: "any" }),
  ],
  { variant: "switch" },
);

function makeRegistry(specs: NodeSpec[]): NodeSpecRegistry {
  const map = new Map(specs.map((s) => [s.kind, s]));
  return { get: (kind: string) => map.get(kind) };
}

const registry = makeRegistry([startSpec, endSpec, decisionIfElseSpec, decisionSwitchSpec]);

describe("validateGraph — decision node rules", () => {
  describe("if-else variant", () => {
    it("accepts a valid if-else decision graph", () => {
      const start = makeNode({ kind: "start", data: {} });
      const decision = makeNode({ kind: "decision", data: { condition: "x > 0" } });
      const endTrue = makeNode({ kind: "end", data: {} });
      const endFalse = makeNode({ kind: "end", data: {} });
      // Use single entry node: start → decision → endTrue / endFalse
      // But multiple end nodes are fine (they're terminal, not entry)
      // However, multiple end nodes cause MULTIPLE_ENTRY_NODES? No, end has only input ports.
      // Actually start is the only entry node. Let's use a simpler valid graph.
      let g = makeGraph("if-else-valid");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, decision);
      g = addNodeToGraph(g, endTrue);
      g = addNodeToGraph(g, endFalse);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: decision.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "true", target: endTrue.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: decision.id,
          sourcePort: "false",
          target: endFalse.id,
          targetPort: "in",
        }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
    });

    it("rejects orphan edge — sourcePort not in declared branches", () => {
      const start = makeNode({ kind: "start", data: {} });
      const decision = makeNode({ kind: "decision", data: { condition: "x > 0" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("if-else-orphan");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, decision);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: decision.id, targetPort: "in" }),
      );
      // "bogus" is not a declared branch for if-else decision
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "bogus", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const orphan = result.error.filter(
          (e: GraphValidationError) => e.code === "DECISION_ORPHAN_EDGE",
        );
        expect(orphan.length).toBe(1);
        expect(orphan[0].message).toContain("bogus");
        expect(orphan[0].message).toContain(decision.id);
      }
    });

    it("rejects duplicate branches — multiple edges from same sourcePort", () => {
      const start = makeNode({ kind: "start", data: {} });
      const decision = makeNode({ kind: "decision", data: { condition: "x > 0" } });
      const endA = makeNode({ kind: "end", data: {} });
      const endB = makeNode({ kind: "end", data: {} });
      let g = makeGraph("if-else-dup");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, decision);
      g = addNodeToGraph(g, endA);
      g = addNodeToGraph(g, endB);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: decision.id, targetPort: "in" }),
      );
      // Two edges from "true" port
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "true", target: endA.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "true", target: endB.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const dup = result.error.filter(
          (e: GraphValidationError) => e.code === "DECISION_DUPLICATE_BRANCH",
        );
        expect(dup.length).toBe(1);
        expect(dup[0].message).toContain("true");
        expect(dup[0].message).toContain("2");
      }
    });

    it("accepts `default` as a valid sourcePort for if-else (always allowed)", () => {
      const start = makeNode({ kind: "start", data: {} });
      const decision = makeNode({ kind: "decision", data: { condition: "x > 0" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("if-else-default");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, decision);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: decision.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "default", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      // No orphan error for "default"
      if (!result.ok) {
        const orphan = result.error.filter(
          (e: GraphValidationError) => e.code === "DECISION_ORPHAN_EDGE",
        );
        expect(orphan.length).toBe(0);
      }
    });

    it("does not warn about missing default for if-else (not a declared port)", () => {
      const start = makeNode({ kind: "start", data: {} });
      const decision = makeNode({ kind: "decision", data: { condition: "x > 0" } });
      const endTrue = makeNode({ kind: "end", data: {} });
      const endFalse = makeNode({ kind: "end", data: {} });
      let g = makeGraph("if-else-no-default-ok");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, decision);
      g = addNodeToGraph(g, endTrue);
      g = addNodeToGraph(g, endFalse);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: decision.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "true", target: endTrue.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: decision.id,
          sourcePort: "false",
          target: endFalse.id,
          targetPort: "in",
        }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const defaultWarnings = result.value.filter(
          (w: GraphValidationError) => w.code === "DECISION_MISSING_DEFAULT",
        );
        expect(defaultWarnings.length).toBe(0);
      }
    });
  });

  describe("switch variant", () => {
    it("accepts a valid switch decision graph with default edge", () => {
      const start = makeNode({ kind: "start", data: {} });
      const sw = makeNode({
        kind: "decision-switch",
        data: {
          branches: [
            { label: "Case A", condition: "v === 'a'" },
            { label: "Case B", condition: "v === 'b'" },
          ],
        },
      });
      const endA = makeNode({ kind: "end", data: {} });
      const endB = makeNode({ kind: "end", data: {} });
      const endDef = makeNode({ kind: "end", data: {} });
      let g = makeGraph("switch-valid");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, sw);
      g = addNodeToGraph(g, endA);
      g = addNodeToGraph(g, endB);
      g = addNodeToGraph(g, endDef);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: sw.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: sw.id, sourcePort: "branch-case-a", target: endA.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: sw.id, sourcePort: "branch-case-b", target: endB.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: sw.id, sourcePort: "default", target: endDef.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(0);
      }
    });

    it("rejects orphan edge — sourcePort not in data-driven branches", () => {
      const start = makeNode({ kind: "start", data: {} });
      const sw = makeNode({
        kind: "decision-switch",
        data: {
          branches: [{ label: "Alpha", condition: "v === 'a'" }],
        },
      });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("switch-orphan");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, sw);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: sw.id, targetPort: "in" }),
      );
      // "branch-nonexistent" is not a declared branch for this node's data
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: sw.id,
          sourcePort: "branch-nonexistent",
          target: end.id,
          targetPort: "in",
        }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const orphan = result.error.filter(
          (e: GraphValidationError) => e.code === "DECISION_ORPHAN_EDGE",
        );
        expect(orphan.length).toBe(1);
        expect(orphan[0].message).toContain("branch-nonexistent");
      }
    });

    it("rejects duplicate branches — multiple edges from same sourcePort on switch", () => {
      const start = makeNode({ kind: "start", data: {} });
      const sw = makeNode({
        kind: "decision-switch",
        data: {
          branches: [{ label: "X", condition: "v === 'x'" }],
        },
      });
      const endA = makeNode({ kind: "end", data: {} });
      const endB = makeNode({ kind: "end", data: {} });
      let g = makeGraph("switch-dup");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, sw);
      g = addNodeToGraph(g, endA);
      g = addNodeToGraph(g, endB);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: sw.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: sw.id, sourcePort: "branch-x", target: endA.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: sw.id, sourcePort: "branch-x", target: endB.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const dup = result.error.filter(
          (e: GraphValidationError) => e.code === "DECISION_DUPLICATE_BRANCH",
        );
        expect(dup.length).toBe(1);
        expect(dup[0].message).toContain("branch-x");
        expect(dup[0].message).toContain("2");
      }
    });

    it("warns when missing default edge on switch", () => {
      const start = makeNode({ kind: "start", data: {} });
      const sw = makeNode({
        kind: "decision-switch",
        data: {
          branches: [{ label: "Only", condition: "v === 1" }],
        },
      });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("switch-no-default");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, sw);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: sw.id, targetPort: "in" }),
      );
      // Only connect the branch port, no default edge
      g = addEdgeToGraph(
        g,
        makeEdge({ source: sw.id, sourcePort: "branch-only", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      // Should still be ok (warning, not error)
      expect(result.ok).toBe(true);
      if (result.ok) {
        const defaultWarnings = result.value.filter(
          (w: GraphValidationError) => w.code === "DECISION_MISSING_DEFAULT",
        );
        expect(defaultWarnings.length).toBe(1);
        expect(defaultWarnings[0].severity).toBe("warning");
        expect(defaultWarnings[0].message).toContain("default");
        expect(defaultWarnings[0].message).toContain(sw.id);
      }
    });

    it("does not warn when default edge is present on switch", () => {
      const start = makeNode({ kind: "start", data: {} });
      const sw = makeNode({
        kind: "decision-switch",
        data: {
          branches: [{ label: "A", condition: "v === 'a'" }],
        },
      });
      const endA = makeNode({ kind: "end", data: {} });
      const endDef = makeNode({ kind: "end", data: {} });
      let g = makeGraph("switch-with-default");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, sw);
      g = addNodeToGraph(g, endA);
      g = addNodeToGraph(g, endDef);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: sw.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: sw.id, sourcePort: "branch-a", target: endA.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: sw.id, sourcePort: "default", target: endDef.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const defaultWarnings = result.value.filter(
          (w: GraphValidationError) => w.code === "DECISION_MISSING_DEFAULT",
        );
        expect(defaultWarnings.length).toBe(0);
      }
    });

    it("derives branch ports from data.branches (not spec ports)", () => {
      const start = makeNode({ kind: "start", data: {} });
      // Node data has different branches than spec defaults
      const sw = makeNode({
        kind: "decision-switch",
        data: {
          branches: [
            { label: "Custom One", condition: "c === 1" },
            { label: "Custom Two", condition: "c === 2" },
            { label: "Custom Three", condition: "c === 3" },
          ],
        },
      });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("switch-custom-branches");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, sw);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: sw.id, targetPort: "in" }),
      );
      // Use custom branch port IDs (derived from data labels)
      g = addEdgeToGraph(
        g,
        makeEdge({
          source: sw.id,
          sourcePort: "branch-custom-one",
          target: end.id,
          targetPort: "in",
        }),
      );

      const result = validateGraph(g, registry);
      // No orphan error for data-derived branch
      if (!result.ok) {
        const orphan = result.error.filter(
          (e: GraphValidationError) => e.code === "DECISION_ORPHAN_EDGE",
        );
        expect(orphan.length).toBe(0);
      }
    });
  });

  describe("edge cases", () => {
    it("collects multiple decision errors simultaneously", () => {
      const start = makeNode({ kind: "start", data: {} });
      const decision = makeNode({ kind: "decision", data: { condition: "x" } });
      const endA = makeNode({ kind: "end", data: {} });
      const endB = makeNode({ kind: "end", data: {} });
      const endC = makeNode({ kind: "end", data: {} });
      let g = makeGraph("multi-error");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, decision);
      g = addNodeToGraph(g, endA);
      g = addNodeToGraph(g, endB);
      g = addNodeToGraph(g, endC);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: decision.id, targetPort: "in" }),
      );
      // Orphan edge
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "nope", target: endA.id, targetPort: "in" }),
      );
      // Duplicate on "true"
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "true", target: endB.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "true", target: endC.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const orphan = result.error.filter(
          (e: GraphValidationError) => e.code === "DECISION_ORPHAN_EDGE",
        );
        const dup = result.error.filter(
          (e: GraphValidationError) => e.code === "DECISION_DUPLICATE_BRANCH",
        );
        expect(orphan.length).toBe(1);
        expect(dup.length).toBe(1);
      }
    });

    it("non-decision nodes are not affected by decision rules", () => {
      const taskSpec = spec("task", [
        makeInputPort({ id: "in", label: "In", dataType: "any" }),
        makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
      ]);
      const reg = makeRegistry([startSpec, endSpec, taskSpec]);
      const start = makeNode({ kind: "start", data: {} });
      const task = makeNode({ kind: "task", data: {} });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("non-decision");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, task);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: task.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: task.id, sourcePort: "out", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, reg);
      expect(result.ok).toBe(true);
    });

    it("decision node with no outgoing edges — no orphan or duplicate errors", () => {
      const start = makeNode({ kind: "start", data: {} });
      const decision = makeNode({ kind: "decision", data: { condition: "x" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("no-outgoing");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, decision);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: decision.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      // Will have other errors (unreachable end, no terminal reachable, etc.) but no decision-specific errors
      if (!result.ok) {
        const decisionErrors = result.error.filter(
          (e: GraphValidationError) =>
            e.code === "DECISION_ORPHAN_EDGE" || e.code === "DECISION_DUPLICATE_BRANCH",
        );
        expect(decisionErrors.length).toBe(0);
      }
    });

    it("switch node with empty data.branches — only default is allowed", () => {
      const start = makeNode({ kind: "start", data: {} });
      const sw = makeNode({
        kind: "decision-switch",
        data: { branches: [] },
      });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("switch-empty-branches");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, sw);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: sw.id, targetPort: "in" }),
      );
      // Only default is valid
      g = addEdgeToGraph(
        g,
        makeEdge({ source: sw.id, sourcePort: "default", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(true);
    });

    it("error messages are descriptive and include node id, kind, and sourcePort", () => {
      const start = makeNode({ kind: "start", data: {} });
      const decision = makeNode({ kind: "decision", data: { condition: "x" } });
      const end = makeNode({ kind: "end", data: {} });
      let g = makeGraph("descriptive-messages");
      g = addNodeToGraph(g, start);
      g = addNodeToGraph(g, decision);
      g = addNodeToGraph(g, end);
      g = addEdgeToGraph(
        g,
        makeEdge({ source: start.id, sourcePort: "out", target: decision.id, targetPort: "in" }),
      );
      g = addEdgeToGraph(
        g,
        makeEdge({ source: decision.id, sourcePort: "invalid", target: end.id, targetPort: "in" }),
      );

      const result = validateGraph(g, registry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const orphan = result.error.find(
          (e: GraphValidationError) => e.code === "DECISION_ORPHAN_EDGE",
        );
        expect(orphan).toBeDefined();
        if (orphan) {
          expect(orphan.message).toContain(decision.id);
          expect(orphan.message).toContain("decision");
          expect(orphan.message).toContain("invalid");
        }
      }
    });
  });
});
