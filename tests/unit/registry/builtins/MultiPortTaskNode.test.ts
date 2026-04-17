import { describe, it, expect } from "vitest";
import { MultiPortTaskNodeSpec } from "@/registry/builtins/MultiPortTaskNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";
import { NodeRegistry } from "@/registry/NodeRegistry";

describe("MultiPortTaskNodeSpec", () => {
  describe("spec shape", () => {
    it("has kind 'task-multi'", () => {
      expect(MultiPortTaskNodeSpec.kind).toBe("task-multi");
    });

    it("has category 'flow'", () => {
      expect(MultiPortTaskNodeSpec.category).toBe("flow");
    });

    it("has label 'Multi-Port Task'", () => {
      expect(MultiPortTaskNodeSpec.label).toBe("Multi-Port Task");
    });

    it("has an icon", () => {
      expect(MultiPortTaskNodeSpec.icon).toBeTruthy();
    });

    it("has exactly 5 ports (2 inputs + 3 outputs)", () => {
      expect(MultiPortTaskNodeSpec.ports).toHaveLength(5);
    });

    it("has 2 input ports", () => {
      const inputs = MultiPortTaskNodeSpec.ports.filter((p) => p.kind === "in");
      expect(inputs).toHaveLength(2);
    });

    it("has 3 output ports", () => {
      const outputs = MultiPortTaskNodeSpec.ports.filter((p) => p.kind === "out");
      expect(outputs).toHaveLength(3);
    });
  });

  describe("input ports", () => {
    it("inA has dataType string", () => {
      const inA = MultiPortTaskNodeSpec.ports.find((p) => p.id === "inA");
      expect(inA).toBeDefined();
      expect(inA?.kind).toBe("in");
      expect(inA?.dataType).toBe("string");
      expect(inA?.label).toBe("Input A");
    });

    it("inB has dataType json", () => {
      const inB = MultiPortTaskNodeSpec.ports.find((p) => p.id === "inB");
      expect(inB).toBeDefined();
      expect(inB?.kind).toBe("in");
      expect(inB?.dataType).toBe("json");
      expect(inB?.label).toBe("Input B");
    });
  });

  describe("output ports", () => {
    it("outA has dataType string", () => {
      const outA = MultiPortTaskNodeSpec.ports.find((p) => p.id === "outA");
      expect(outA).toBeDefined();
      expect(outA?.kind).toBe("out");
      expect(outA?.dataType).toBe("string");
      expect(outA?.label).toBe("Output A");
    });

    it("outB has dataType json", () => {
      const outB = MultiPortTaskNodeSpec.ports.find((p) => p.id === "outB");
      expect(outB).toBeDefined();
      expect(outB?.kind).toBe("out");
      expect(outB?.dataType).toBe("json");
      expect(outB?.label).toBe("Output B");
    });

    it("outC has dataType any", () => {
      const outC = MultiPortTaskNodeSpec.ports.find((p) => p.id === "outC");
      expect(outC).toBeDefined();
      expect(outC?.kind).toBe("out");
      expect(outC?.dataType).toBe("any");
      expect(outC?.label).toBe("Output C");
    });
  });

  describe("port IDs are unique", () => {
    it("all port IDs are distinct", () => {
      const ids = MultiPortTaskNodeSpec.ports.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("propertySchema", () => {
    it("accepts valid data", () => {
      const result = MultiPortTaskNodeSpec.propertySchema.safeParse({
        name: "MyMultiTask",
        params: { key: "value" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts name only (params defaults)", () => {
      const result = MultiPortTaskNodeSpec.propertySchema.safeParse({ name: "MyTask" });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = MultiPortTaskNodeSpec.propertySchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("defaultData", () => {
    it("conforms to propertySchema", () => {
      const result = MultiPortTaskNodeSpec.propertySchema.safeParse(
        MultiPortTaskNodeSpec.defaultData,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("registry integration", () => {
    it("registers cleanly in a NodeRegistry", () => {
      const registry = new NodeRegistry();
      registry.register(MultiPortTaskNodeSpec);
      expect(registry.resolve("task-multi")).toBe(MultiPortTaskNodeSpec);
    });

    it("can coexist with regular TaskNodeSpec", () => {
      const registry = new NodeRegistry();
      registry.register(TaskNodeSpec);
      registry.register(MultiPortTaskNodeSpec);
      expect(registry.has("task")).toBe(true);
      expect(registry.has("task-multi")).toBe(true);
    });
  });

  describe("fixture re-export", () => {
    it("is accessible from tests/fixtures/multiPortSpec", async () => {
      const { MultiPortTaskNodeSpec: fixtureSpec } =
        await import("../../../fixtures/multiPortSpec");
      expect(fixtureSpec).toBe(MultiPortTaskNodeSpec);
    });
  });
});
