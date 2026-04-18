import { describe, it, expect } from "vitest";
import { DecisionNodeSpec } from "@/registry/builtins/DecisionNode.spec";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { validateSpec } from "@/domain/models/nodeSpec";

describe("DecisionNodeSpec", () => {
  describe("spec shape", () => {
    it("has kind 'decision'", () => {
      expect(DecisionNodeSpec.kind).toBe("decision");
    });

    it("has variant 'if-else'", () => {
      expect(DecisionNodeSpec.variant).toBe("if-else");
    });

    it("has category 'flow'", () => {
      expect(DecisionNodeSpec.category).toBe("flow");
    });

    it("has label 'Decision'", () => {
      expect(DecisionNodeSpec.label).toBe("Decision");
    });

    it("has icon 'git-branch'", () => {
      expect(DecisionNodeSpec.icon).toBe("git-branch");
    });

    it("has exactly 1 input port with id 'in'", () => {
      const inputs = DecisionNodeSpec.ports.filter((p) => p.kind === "in");
      expect(inputs).toHaveLength(1);
      expect(inputs[0].id).toBe("in");
      expect(inputs[0].label).toBe("In");
      expect(inputs[0].dataType).toBe("any");
    });

    it("has exactly 2 output ports with ids 'true' and 'false'", () => {
      const outputs = DecisionNodeSpec.ports.filter((p) => p.kind === "out");
      expect(outputs).toHaveLength(2);

      const truePort = outputs.find((p) => p.id === "true");
      const falsePort = outputs.find((p) => p.id === "false");

      expect(truePort).toBeDefined();
      expect(truePort?.label).toBe("True");
      expect(truePort?.dataType).toBe("any");

      expect(falsePort).toBeDefined();
      expect(falsePort?.label).toBe("False");
      expect(falsePort?.dataType).toBe("any");
    });

    it("has 3 ports total (1 in + 2 out)", () => {
      expect(DecisionNodeSpec.ports).toHaveLength(3);
    });

    it("has empty capabilities", () => {
      expect(DecisionNodeSpec.capabilities).toEqual([]);
    });

    it("passes validateSpec without throwing", () => {
      expect(() => {
        validateSpec(DecisionNodeSpec);
      }).not.toThrow();
    });
  });

  describe("propertySchema", () => {
    it("accepts valid condition string", () => {
      const result = DecisionNodeSpec.propertySchema.safeParse({ condition: "x > 0" });
      expect(result.success).toBe(true);
    });

    it("rejects empty condition", () => {
      const result = DecisionNodeSpec.propertySchema.safeParse({ condition: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing condition", () => {
      const result = DecisionNodeSpec.propertySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects non-string condition", () => {
      const result = DecisionNodeSpec.propertySchema.safeParse({ condition: 42 });
      expect(result.success).toBe(false);
    });

    it("rejects null condition", () => {
      const result = DecisionNodeSpec.propertySchema.safeParse({ condition: null });
      expect(result.success).toBe(false);
    });
  });

  describe("defaultData", () => {
    it("has a non-empty condition", () => {
      expect(DecisionNodeSpec.defaultData.condition).toBeTruthy();
      expect(DecisionNodeSpec.defaultData.condition.length).toBeGreaterThan(0);
    });

    it("conforms to propertySchema", () => {
      const result = DecisionNodeSpec.propertySchema.safeParse(DecisionNodeSpec.defaultData);
      expect(result.success).toBe(true);
    });
  });

  describe("registry integration", () => {
    it("registers cleanly in a NodeRegistry", () => {
      const registry = new NodeRegistry();
      registry.register(DecisionNodeSpec);
      expect(registry.resolve("decision")).toBe(DecisionNodeSpec);
    });

    it("appears in list after registration", () => {
      const registry = new NodeRegistry();
      registry.register(DecisionNodeSpec);
      expect(registry.list()).toContain(DecisionNodeSpec);
    });

    it("does not conflict with other builtin kinds", () => {
      const registry = new NodeRegistry();
      registry.register(DecisionNodeSpec);

      // Register another kind — no conflict
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
      expect(registry.resolve("decision")).toBe(DecisionNodeSpec);
    });
  });
});
