import { describe, it, expect } from "vitest";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";
import { NodeRegistry } from "@/registry/NodeRegistry";

describe("TaskNodeSpec", () => {
  describe("spec shape", () => {
    it("has kind 'task'", () => {
      expect(TaskNodeSpec.kind).toBe("task");
    });

    it("has 1 input port and 1 output port", () => {
      expect(TaskNodeSpec.ports).toHaveLength(2);
      const input = TaskNodeSpec.ports.find((p) => p.kind === "in");
      const output = TaskNodeSpec.ports.find((p) => p.kind === "out");
      expect(input).toBeDefined();
      expect(input?.id).toBe("in");
      expect(output).toBeDefined();
      expect(output?.id).toBe("out");
    });

    it("has category, label, and icon", () => {
      expect(TaskNodeSpec.category).toBe("flow");
      expect(TaskNodeSpec.label).toBe("Task");
      expect(TaskNodeSpec.icon).toBe("cog");
    });
  });

  describe("propertySchema", () => {
    it("accepts valid data with name and params", () => {
      const result = TaskNodeSpec.propertySchema.safeParse({ name: "MyTask", params: { key: 1 } });
      expect(result.success).toBe(true);
    });

    it("accepts data with name only (params defaults to {})", () => {
      const result = TaskNodeSpec.propertySchema.safeParse({ name: "MyTask" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params).toEqual({});
      }
    });

    it("rejects empty name", () => {
      const result = TaskNodeSpec.propertySchema.safeParse({ name: "", params: {} });
      expect(result.success).toBe(false);
    });

    it("rejects missing name", () => {
      const result = TaskNodeSpec.propertySchema.safeParse({ params: {} });
      expect(result.success).toBe(false);
    });

    it("rejects non-string name", () => {
      const result = TaskNodeSpec.propertySchema.safeParse({ name: 42, params: {} });
      expect(result.success).toBe(false);
    });
  });

  describe("defaultData", () => {
    it("has name 'Task' and empty params", () => {
      expect(TaskNodeSpec.defaultData).toEqual({ name: "Task", params: {} });
    });

    it("conforms to propertySchema", () => {
      const result = TaskNodeSpec.propertySchema.safeParse(TaskNodeSpec.defaultData);
      expect(result.success).toBe(true);
    });
  });

  describe("registry integration", () => {
    it("registers cleanly in a NodeRegistry", () => {
      const registry = new NodeRegistry();
      registry.register(TaskNodeSpec);
      expect(registry.resolve("task")).toBe(TaskNodeSpec);
    });

    it("appears in list after registration", () => {
      const registry = new NodeRegistry();
      registry.register(TaskNodeSpec);
      expect(registry.list()).toContain(TaskNodeSpec);
    });
  });
});
