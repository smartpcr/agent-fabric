import { describe, it, expect } from "vitest";
import { StartNodeSpec } from "@/registry/builtins/StartNode.spec";
import { NodeRegistry } from "@/registry/NodeRegistry";

describe("StartNodeSpec", () => {
  describe("spec shape", () => {
    it("has kind 'start'", () => {
      expect(StartNodeSpec.kind).toBe("start");
    });

    it("has exactly 1 output port with id 'out'", () => {
      expect(StartNodeSpec.ports).toHaveLength(1);
      expect(StartNodeSpec.ports[0].id).toBe("out");
      expect(StartNodeSpec.ports[0].kind).toBe("out");
    });

    it("has isEntry capability", () => {
      expect(StartNodeSpec.capabilities).toContain("isEntry");
    });

    it("has empty propertySchema that accepts empty object", () => {
      const result = StartNodeSpec.propertySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("has defaultData as empty object", () => {
      expect(StartNodeSpec.defaultData).toEqual({});
    });

    it("defaultData conforms to propertySchema", () => {
      const result = StartNodeSpec.propertySchema.safeParse(StartNodeSpec.defaultData);
      expect(result.success).toBe(true);
    });

    it("has category, label, and icon", () => {
      expect(StartNodeSpec.category).toBe("flow");
      expect(StartNodeSpec.label).toBe("Start");
      expect(StartNodeSpec.icon).toBe("play");
    });
  });

  describe("registry integration", () => {
    it("registers cleanly in a NodeRegistry", () => {
      const registry = new NodeRegistry();
      registry.register(StartNodeSpec);
      expect(registry.resolve("start")).toBe(StartNodeSpec);
    });

    it("appears in list after registration", () => {
      const registry = new NodeRegistry();
      registry.register(StartNodeSpec);
      expect(registry.list()).toContain(StartNodeSpec);
    });
  });
});
