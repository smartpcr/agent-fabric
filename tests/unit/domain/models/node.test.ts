import { describe, it, expect } from "vitest";
import { makeNode, type WorkflowNode } from "@/domain/models/node";

describe("WorkflowNode", () => {
  describe("makeNode", () => {
    it("generates a node with an auto-generated id", () => {
      const node = makeNode({ kind: "task", data: {} });
      expect(node.id).toMatch(/^node_/);
    });

    it("applies default position {x:0, y:0}", () => {
      const node = makeNode({ kind: "task", data: {} });
      expect(node.position).toEqual({ x: 0, y: 0 });
    });

    it("uses provided position", () => {
      const node = makeNode({
        kind: "task",
        data: {},
        position: { x: 100, y: 200 },
      });
      expect(node.position).toEqual({ x: 100, y: 200 });
    });

    it("preserves kind", () => {
      const node = makeNode({ kind: "start", data: {} });
      expect(node.kind).toBe("start");
    });

    it("preserves generic data type", () => {
      interface TaskData {
        prompt: string;
      }
      const node: WorkflowNode<TaskData> = makeNode({
        kind: "task",
        data: { prompt: "hello" },
      });
      expect(node.data.prompt).toBe("hello");
    });

    it("throws when position x is not finite", () => {
      expect(() => makeNode({ kind: "t", data: {}, position: { x: Infinity, y: 0 } })).toThrow(
        "finite number",
      );
    });

    it("throws when position y is not finite", () => {
      expect(() => makeNode({ kind: "t", data: {}, position: { x: 0, y: NaN } })).toThrow(
        "finite number",
      );
    });

    it("returns a frozen object", () => {
      const node = makeNode({ kind: "task", data: {} });
      expect(Object.isFrozen(node)).toBe(true);
    });

    it("returns a frozen position", () => {
      const node = makeNode({ kind: "task", data: {} });
      expect(Object.isFrozen(node.position)).toBe(true);
    });

    it("generates unique ids across calls", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(makeNode({ kind: "t", data: {} }).id);
      }
      expect(ids.size).toBe(100);
    });
  });
});
