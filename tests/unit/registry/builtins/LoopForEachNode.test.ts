import { describe, it, expect } from "vitest";
import { LoopForEachNodeSpec } from "@/registry/builtins/LoopForEachNode.spec";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { validateSpec } from "@/domain/models/nodeSpec";

describe("LoopForEachNodeSpec", () => {
  describe("spec shape", () => {
    it("has kind 'loop-foreach'", () => {
      expect(LoopForEachNodeSpec.kind).toBe("loop-foreach");
    });

    it("has category 'flow'", () => {
      expect(LoopForEachNodeSpec.category).toBe("flow");
    });

    it("has label 'For Each'", () => {
      expect(LoopForEachNodeSpec.label).toBe("For Each");
    });

    it("has icon 'repeat'", () => {
      expect(LoopForEachNodeSpec.icon).toBe("repeat");
    });

    it("has 5 ports total (2 in + 3 out)", () => {
      expect(LoopForEachNodeSpec.ports).toHaveLength(5);
    });

    it("has input port 'in'", () => {
      const port = LoopForEachNodeSpec.ports.find((p) => p.id === "in");
      expect(port).toBeDefined();
      expect(port?.kind).toBe("in");
      expect(port?.label).toBe("In");
      expect(port?.dataType).toBe("any");
    });

    it("has output port 'body-out'", () => {
      const port = LoopForEachNodeSpec.ports.find((p) => p.id === "body-out");
      expect(port).toBeDefined();
      expect(port?.kind).toBe("out");
      expect(port?.label).toBe("Body Out");
      expect(port?.dataType).toBe("any");
    });

    it("has input port 'body-in'", () => {
      const port = LoopForEachNodeSpec.ports.find((p) => p.id === "body-in");
      expect(port).toBeDefined();
      expect(port?.kind).toBe("in");
      expect(port?.label).toBe("Body In");
      expect(port?.dataType).toBe("any");
    });

    it("has output port 'done'", () => {
      const port = LoopForEachNodeSpec.ports.find((p) => p.id === "done");
      expect(port).toBeDefined();
      expect(port?.kind).toBe("out");
      expect(port?.label).toBe("Done");
      expect(port?.dataType).toBe("any");
    });

    it("has output port 'break'", () => {
      const port = LoopForEachNodeSpec.ports.find((p) => p.id === "break");
      expect(port).toBeDefined();
      expect(port?.kind).toBe("out");
      expect(port?.label).toBe("Break");
      expect(port?.dataType).toBe("any");
    });

    it("has exactly 2 input ports (in, body-in)", () => {
      const inputs = LoopForEachNodeSpec.ports.filter((p) => p.kind === "in");
      expect(inputs).toHaveLength(2);
      expect(inputs.map((p) => p.id).sort()).toEqual(["body-in", "in"]);
    });

    it("has exactly 3 output ports (body-out, done, break)", () => {
      const outputs = LoopForEachNodeSpec.ports.filter((p) => p.kind === "out");
      expect(outputs).toHaveLength(3);
      expect(outputs.map((p) => p.id).sort()).toEqual(["body-out", "break", "done"]);
    });

    it("has canHaveBackEdge capability", () => {
      expect(LoopForEachNodeSpec.capabilities).toContain("canHaveBackEdge");
    });

    it("passes validateSpec without throwing", () => {
      expect(() => {
        validateSpec(LoopForEachNodeSpec);
      }).not.toThrow();
    });
  });

  describe("propertySchema", () => {
    it("accepts valid iterable and item strings", () => {
      const result = LoopForEachNodeSpec.propertySchema.safeParse({
        iterable: "users",
        item: "user",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty item string", () => {
      const result = LoopForEachNodeSpec.propertySchema.safeParse({
        iterable: "items",
        item: "",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty iterable", () => {
      const result = LoopForEachNodeSpec.propertySchema.safeParse({
        iterable: "",
        item: "x",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing iterable", () => {
      const result = LoopForEachNodeSpec.propertySchema.safeParse({ item: "x" });
      expect(result.success).toBe(false);
    });

    it("rejects missing item", () => {
      const result = LoopForEachNodeSpec.propertySchema.safeParse({ iterable: "list" });
      expect(result.success).toBe(false);
    });

    it("rejects non-string iterable", () => {
      const result = LoopForEachNodeSpec.propertySchema.safeParse({
        iterable: 42,
        item: "x",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-string item", () => {
      const result = LoopForEachNodeSpec.propertySchema.safeParse({
        iterable: "list",
        item: 42,
      });
      expect(result.success).toBe(false);
    });

    it("rejects null iterable", () => {
      const result = LoopForEachNodeSpec.propertySchema.safeParse({
        iterable: null,
        item: "x",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("defaultData", () => {
    it("has a non-empty iterable", () => {
      expect(LoopForEachNodeSpec.defaultData.iterable).toBeTruthy();
      expect(LoopForEachNodeSpec.defaultData.iterable.length).toBeGreaterThan(0);
    });

    it("has an item string", () => {
      expect(typeof LoopForEachNodeSpec.defaultData.item).toBe("string");
    });

    it("conforms to propertySchema", () => {
      const result = LoopForEachNodeSpec.propertySchema.safeParse(LoopForEachNodeSpec.defaultData);
      expect(result.success).toBe(true);
    });
  });

  describe("registry integration", () => {
    it("registers cleanly in a NodeRegistry", () => {
      const registry = new NodeRegistry();
      registry.register(LoopForEachNodeSpec);
      expect(registry.resolve("loop-foreach")).toBe(LoopForEachNodeSpec);
    });

    it("appears in list after registration", () => {
      const registry = new NodeRegistry();
      registry.register(LoopForEachNodeSpec);
      expect(registry.list()).toContain(LoopForEachNodeSpec);
    });

    it("does not conflict with other builtin kinds", () => {
      const registry = new NodeRegistry();
      registry.register(LoopForEachNodeSpec);

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
      expect(registry.resolve("loop-foreach")).toBe(LoopForEachNodeSpec);
    });
  });
});
