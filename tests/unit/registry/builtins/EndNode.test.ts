import { describe, it, expect } from "vitest";
import { EndNodeSpec } from "@/registry/builtins/EndNode.spec";
import { NodeRegistry } from "@/registry/NodeRegistry";

describe("EndNodeSpec", () => {
  describe("spec shape", () => {
    it("has kind 'end'", () => {
      expect(EndNodeSpec.kind).toBe("end");
    });

    it("has exactly 1 input port with id 'in'", () => {
      expect(EndNodeSpec.ports).toHaveLength(1);
      expect(EndNodeSpec.ports[0].id).toBe("in");
      expect(EndNodeSpec.ports[0].kind).toBe("in");
    });

    it("has isTerminal capability", () => {
      expect(EndNodeSpec.capabilities).toContain("isTerminal");
    });

    it("has empty propertySchema that accepts empty object", () => {
      const result = EndNodeSpec.propertySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("has defaultData as empty object", () => {
      expect(EndNodeSpec.defaultData).toEqual({});
    });

    it("defaultData conforms to propertySchema", () => {
      const result = EndNodeSpec.propertySchema.safeParse(EndNodeSpec.defaultData);
      expect(result.success).toBe(true);
    });

    it("has category, label, and icon", () => {
      expect(EndNodeSpec.category).toBe("flow");
      expect(EndNodeSpec.label).toBe("End");
      expect(EndNodeSpec.icon).toBe("stop");
    });
  });

  describe("registry integration", () => {
    it("registers cleanly in a NodeRegistry", () => {
      const registry = new NodeRegistry();
      registry.register(EndNodeSpec);
      expect(registry.resolve("end")).toBe(EndNodeSpec);
    });

    it("appears in list after registration", () => {
      const registry = new NodeRegistry();
      registry.register(EndNodeSpec);
      expect(registry.list()).toContain(EndNodeSpec);
    });
  });
});
