import { describe, it, expect } from "vitest";
import { LoopWhileNodeSpec } from "@/registry/builtins/LoopWhileNode.spec";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { validateSpec } from "@/domain/models/nodeSpec";

describe("LoopWhileNodeSpec", () => {
  describe("spec shape", () => {
    it("has kind 'loop-while'", () => {
      expect(LoopWhileNodeSpec.kind).toBe("loop-while");
    });

    it("has category 'flow'", () => {
      expect(LoopWhileNodeSpec.category).toBe("flow");
    });

    it("has label 'While Loop'", () => {
      expect(LoopWhileNodeSpec.label).toBe("While Loop");
    });

    it("has icon 'repeat'", () => {
      expect(LoopWhileNodeSpec.icon).toBe("repeat");
    });

    it("has 4 ports total (2 in + 2 out)", () => {
      expect(LoopWhileNodeSpec.ports).toHaveLength(4);
    });

    it("has input port 'in'", () => {
      const port = LoopWhileNodeSpec.ports.find((p) => p.id === "in");
      expect(port).toBeDefined();
      expect(port?.kind).toBe("in");
      expect(port?.label).toBe("In");
      expect(port?.dataType).toBe("any");
    });

    it("has output port 'body-out'", () => {
      const port = LoopWhileNodeSpec.ports.find((p) => p.id === "body-out");
      expect(port).toBeDefined();
      expect(port?.kind).toBe("out");
      expect(port?.label).toBe("Body Out");
      expect(port?.dataType).toBe("any");
    });

    it("has input port 'body-in'", () => {
      const port = LoopWhileNodeSpec.ports.find((p) => p.id === "body-in");
      expect(port).toBeDefined();
      expect(port?.kind).toBe("in");
      expect(port?.label).toBe("Body In");
      expect(port?.dataType).toBe("any");
    });

    it("has output port 'done'", () => {
      const port = LoopWhileNodeSpec.ports.find((p) => p.id === "done");
      expect(port).toBeDefined();
      expect(port?.kind).toBe("out");
      expect(port?.label).toBe("Done");
      expect(port?.dataType).toBe("any");
    });

    it("has exactly 2 input ports (in, body-in)", () => {
      const inputs = LoopWhileNodeSpec.ports.filter((p) => p.kind === "in");
      expect(inputs).toHaveLength(2);
      expect(inputs.map((p) => p.id).sort()).toEqual(["body-in", "in"]);
    });

    it("has exactly 2 output ports (body-out, done)", () => {
      const outputs = LoopWhileNodeSpec.ports.filter((p) => p.kind === "out");
      expect(outputs).toHaveLength(2);
      expect(outputs.map((p) => p.id).sort()).toEqual(["body-out", "done"]);
    });

    it("has canHaveBackEdge capability", () => {
      expect(LoopWhileNodeSpec.capabilities).toContain("canHaveBackEdge");
    });

    it("passes validateSpec without throwing", () => {
      expect(() => {
        validateSpec(LoopWhileNodeSpec);
      }).not.toThrow();
    });
  });

  describe("propertySchema", () => {
    it("accepts valid condition string", () => {
      const result = LoopWhileNodeSpec.propertySchema.safeParse({ condition: "x < 10" });
      expect(result.success).toBe(true);
    });

    it("rejects empty condition", () => {
      const result = LoopWhileNodeSpec.propertySchema.safeParse({ condition: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing condition", () => {
      const result = LoopWhileNodeSpec.propertySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects non-string condition", () => {
      const result = LoopWhileNodeSpec.propertySchema.safeParse({ condition: 42 });
      expect(result.success).toBe(false);
    });

    it("rejects null condition", () => {
      const result = LoopWhileNodeSpec.propertySchema.safeParse({ condition: null });
      expect(result.success).toBe(false);
    });
  });

  describe("defaultData", () => {
    it("has a non-empty condition", () => {
      expect(LoopWhileNodeSpec.defaultData.condition).toBeTruthy();
      expect(LoopWhileNodeSpec.defaultData.condition.length).toBeGreaterThan(0);
    });

    it("conforms to propertySchema", () => {
      const result = LoopWhileNodeSpec.propertySchema.safeParse(LoopWhileNodeSpec.defaultData);
      expect(result.success).toBe(true);
    });
  });

  describe("registry integration", () => {
    it("registers cleanly in a NodeRegistry", () => {
      const registry = new NodeRegistry();
      registry.register(LoopWhileNodeSpec);
      expect(registry.resolve("loop-while")).toBe(LoopWhileNodeSpec);
    });

    it("appears in list after registration", () => {
      const registry = new NodeRegistry();
      registry.register(LoopWhileNodeSpec);
      expect(registry.list()).toContain(LoopWhileNodeSpec);
    });

    it("does not conflict with other builtin kinds", () => {
      const registry = new NodeRegistry();
      registry.register(LoopWhileNodeSpec);

      registry.register({
        kind: "task",
        category: "flow",
        label: "Task",
        icon: "cog",
        ports: [],
        propertySchema: { safeParse: () => ({ success: true }) } as never,
        defaultData: {},
        capabilities: [],
      });

      expect(registry.list()).toHaveLength(2);
      expect(registry.resolve("loop-while")).toBe(LoopWhileNodeSpec);
    });
  });
});
