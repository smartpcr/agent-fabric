import { describe, it, expect } from "vitest";
import { makeEdge } from "@/domain/models/edge";

const validOpts = {
  source: "node1",
  sourcePort: "out1",
  target: "node2",
  targetPort: "in1",
};

describe("WorkflowEdge", () => {
  describe("makeEdge", () => {
    it("generates a unique id prefixed with edge_", () => {
      const edge = makeEdge(validOpts);
      expect(edge.id).toMatch(/^edge_/);
    });

    it("generates unique ids across calls", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(makeEdge(validOpts).id);
      }
      expect(ids.size).toBe(100);
    });

    it("defaults kind to 'default'", () => {
      const edge = makeEdge(validOpts);
      expect(edge.kind).toBe("default");
    });

    it("accepts kind 'loop-back'", () => {
      const edge = makeEdge({ ...validOpts, kind: "loop-back" });
      expect(edge.kind).toBe("loop-back");
    });

    it("preserves source and target", () => {
      const edge = makeEdge(validOpts);
      expect(edge.source).toBe("node1");
      expect(edge.sourcePort).toBe("out1");
      expect(edge.target).toBe("node2");
      expect(edge.targetPort).toBe("in1");
    });

    it("omits label and condition when not provided", () => {
      const edge = makeEdge(validOpts);
      expect(edge.label).toBeUndefined();
      expect(edge.condition).toBeUndefined();
    });

    it("includes label when provided", () => {
      const edge = makeEdge({ ...validOpts, label: "success" });
      expect(edge.label).toBe("success");
    });

    it("includes condition when provided", () => {
      const edge = makeEdge({ ...validOpts, condition: "x > 0" });
      expect(edge.condition).toBe("x > 0");
    });

    it("throws when source is empty", () => {
      expect(() => makeEdge({ ...validOpts, source: "" })).toThrow("non-empty string");
    });

    it("throws when source is whitespace", () => {
      expect(() => makeEdge({ ...validOpts, source: "  " })).toThrow("non-empty string");
    });

    it("throws when sourcePort is empty", () => {
      expect(() => makeEdge({ ...validOpts, sourcePort: "" })).toThrow("non-empty string");
    });

    it("throws when target is empty", () => {
      expect(() => makeEdge({ ...validOpts, target: "" })).toThrow("non-empty string");
    });

    it("throws when targetPort is empty", () => {
      expect(() => makeEdge({ ...validOpts, targetPort: "" })).toThrow("non-empty string");
    });

    it("returns a frozen object", () => {
      const edge = makeEdge(validOpts);
      expect(Object.isFrozen(edge)).toBe(true);
    });
  });
});
