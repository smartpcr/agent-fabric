import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateConnection, type NodeSpecRegistry } from "@/domain/validation/connectionRules";
import { makeGraph, addNodeToGraph } from "@/domain/models/graph";
import { makeNode } from "@/domain/models/node";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const emptySchema = z.object({});

function typedSpec(kind: string, outType: string, inType: string): NodeSpec {
  return {
    kind,
    category: "test",
    label: kind,
    icon: "box",
    ports: [
      makeOutputPort({ id: "out", label: "Out", dataType: outType }),
      makeInputPort({ id: "in", label: "In", dataType: inType }),
    ],
    propertySchema: emptySchema,
    defaultData: {},
    capabilities: [],
  };
}

// 4 types for the matrix
const TYPES = ["string", "number", "json", "any"] as const;

// Create a spec for each type as source (output) and target (input)
const specs: NodeSpec[] = [];
for (const t of TYPES) {
  specs.push(typedSpec(`src-${t}`, t, "any")); // output = t, input = any (unused)
  specs.push(typedSpec(`tgt-${t}`, "any", t)); // output = any (unused), input = t
}

function makeRegistry(s: NodeSpec[]): NodeSpecRegistry {
  const map = new Map(s.map((sp) => [sp.kind, sp]));
  return { get: (kind: string) => map.get(kind) };
}

const registry = makeRegistry(specs);

function testConnection(
  sourceType: string,
  targetType: string,
): { ok: boolean; code?: string; message?: string } {
  const src = makeNode({ kind: `src-${sourceType}`, data: {} });
  const tgt = makeNode({ kind: `tgt-${targetType}`, data: {} });
  let g = makeGraph("G");
  g = addNodeToGraph(g, src);
  g = addNodeToGraph(g, tgt);

  const result = validateConnection(
    g,
    { nodeId: src.id, portId: "out" },
    { nodeId: tgt.id, portId: "in" },
    registry,
  );

  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, code: result.error.code, message: result.error.message };
}

describe("connectionRules — dataType mismatch rejection", () => {
  describe("4×4 type matrix", () => {
    // Expected results:
    // any → any: ok     any → string: ok     any → number: ok     any → json: ok
    // string → any: ok  string → string: ok  string → number: ✗   string → json: ✗
    // number → any: ok  number → string: ✗   number → number: ok  number → json: ✗
    // json → any: ok    json → string: ✗     json → number: ✗     json → json: ok

    describe("source type: any", () => {
      it.each(TYPES)("any → %s is accepted", (targetType) => {
        const result = testConnection("any", targetType);
        expect(result.ok).toBe(true);
      });
    });

    describe("target type: any", () => {
      it.each(TYPES)("%s → any is accepted", (sourceType) => {
        const result = testConnection(sourceType, "any");
        expect(result.ok).toBe(true);
      });
    });

    describe("same type (identity)", () => {
      it.each(["string", "number", "json"] as const)("%s → %s is accepted", (t) => {
        const result = testConnection(t, t);
        expect(result.ok).toBe(true);
      });
    });

    describe("mismatched types are rejected", () => {
      const mismatches: [string, string][] = [
        ["string", "number"],
        ["string", "json"],
        ["number", "string"],
        ["number", "json"],
        ["json", "string"],
        ["json", "number"],
      ];

      it.each(mismatches)("%s → %s is rejected with DATA_TYPE_MISMATCH", (src, tgt) => {
        const result = testConnection(src, tgt);
        expect(result.ok).toBe(false);
        expect(result.code).toBe("DATA_TYPE_MISMATCH");
      });
    });
  });

  describe("rejection message quality", () => {
    it("message includes source data type", () => {
      const result = testConnection("number", "string");
      expect(result.ok).toBe(false);
      expect(result.message).toContain("number");
    });

    it("message includes target data type", () => {
      const result = testConnection("number", "string");
      expect(result.ok).toBe(false);
      expect(result.message).toContain("string");
    });

    it("message includes both source and target types for all mismatches", () => {
      const mismatches: [string, string][] = [
        ["string", "number"],
        ["string", "json"],
        ["number", "string"],
        ["number", "json"],
        ["json", "string"],
        ["json", "number"],
      ];

      for (const [src, tgt] of mismatches) {
        const result = testConnection(src, tgt);
        expect(result.ok).toBe(false);
        expect(result.message).toContain(src);
        expect(result.message).toContain(tgt);
      }
    });

    it("message format is human-readable", () => {
      const result = testConnection("json", "number");
      expect(result.ok).toBe(false);
      // Check the message follows the pattern: Cannot assign "X" to "Y"
      expect(result.message).toMatch(/Cannot assign "json" to "number"/);
    });
  });
});
