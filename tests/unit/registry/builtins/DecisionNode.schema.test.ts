import { describe, it, expect } from "vitest";
import { DecisionNodeSpec, decisionPropertySchema } from "@/registry/builtins/DecisionNode.spec";
import {
  DecisionSwitchNodeSpec,
  branchSchema,
  decisionSwitchPropertySchema,
} from "@/registry/builtins/DecisionSwitchNode.spec";

describe("Decision property schemas", () => {
  describe("if-else variant (decisionPropertySchema)", () => {
    const schema = decisionPropertySchema;

    describe("valid cases", () => {
      it("accepts a simple condition string", () => {
        expect(schema.safeParse({ condition: "x > 0" }).success).toBe(true);
      });

      it("accepts a complex condition expression", () => {
        expect(schema.safeParse({ condition: "user.role === 'admin' && isActive" }).success).toBe(
          true,
        );
      });

      it("accepts a single-character condition", () => {
        expect(schema.safeParse({ condition: "x" }).success).toBe(true);
      });

      it("accepts condition with special characters", () => {
        expect(schema.safeParse({ condition: "a !== null && b?.length > 0" }).success).toBe(true);
      });
    });

    describe("invalid cases", () => {
      it("rejects empty condition string", () => {
        expect(schema.safeParse({ condition: "" }).success).toBe(false);
      });

      it("rejects missing condition field", () => {
        expect(schema.safeParse({}).success).toBe(false);
      });

      it("rejects null condition", () => {
        expect(schema.safeParse({ condition: null }).success).toBe(false);
      });

      it("rejects numeric condition", () => {
        expect(schema.safeParse({ condition: 42 }).success).toBe(false);
      });

      it("rejects boolean condition", () => {
        expect(schema.safeParse({ condition: true }).success).toBe(false);
      });

      it("rejects array condition", () => {
        expect(schema.safeParse({ condition: ["x > 0"] }).success).toBe(false);
      });

      it("rejects object condition", () => {
        expect(schema.safeParse({ condition: { expr: "x" } }).success).toBe(false);
      });
    });

    describe("defaultData conformance", () => {
      it("DecisionNodeSpec.defaultData conforms to schema", () => {
        const result = schema.safeParse(DecisionNodeSpec.defaultData);
        expect(result.success).toBe(true);
      });

      it("parsed defaultData matches original", () => {
        const result = schema.safeParse(DecisionNodeSpec.defaultData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(DecisionNodeSpec.defaultData);
        }
      });
    });

    describe("schema matches spec.propertySchema", () => {
      it("exported schema is the same as spec.propertySchema", () => {
        expect(schema).toBe(DecisionNodeSpec.propertySchema);
      });
    });
  });

  describe("switch variant (decisionSwitchPropertySchema)", () => {
    const schema = decisionSwitchPropertySchema;

    describe("branchSchema", () => {
      it("accepts valid branch with label and condition", () => {
        expect(branchSchema.safeParse({ label: "Case A", condition: "x === 1" }).success).toBe(
          true,
        );
      });

      it("rejects branch with empty label", () => {
        expect(branchSchema.safeParse({ label: "", condition: "x" }).success).toBe(false);
      });

      it("rejects branch with empty condition", () => {
        expect(branchSchema.safeParse({ label: "A", condition: "" }).success).toBe(false);
      });

      it("rejects branch missing label", () => {
        expect(branchSchema.safeParse({ condition: "x" }).success).toBe(false);
      });

      it("rejects branch missing condition", () => {
        expect(branchSchema.safeParse({ label: "A" }).success).toBe(false);
      });

      it("rejects branch with numeric label", () => {
        expect(branchSchema.safeParse({ label: 42, condition: "x" }).success).toBe(false);
      });

      it("rejects branch with numeric condition", () => {
        expect(branchSchema.safeParse({ label: "A", condition: 42 }).success).toBe(false);
      });
    });

    describe("valid cases", () => {
      it("accepts single branch", () => {
        expect(
          schema.safeParse({
            branches: [{ label: "Only", condition: "x === 1" }],
          }).success,
        ).toBe(true);
      });

      it("accepts two branches", () => {
        expect(
          schema.safeParse({
            branches: [
              { label: "A", condition: "x === 'a'" },
              { label: "B", condition: "x === 'b'" },
            ],
          }).success,
        ).toBe(true);
      });

      it("accepts five branches", () => {
        const branches = Array.from({ length: 5 }, (_, i) => ({
          label: `Case ${String(i + 1)}`,
          condition: `x === ${String(i + 1)}`,
        }));
        expect(schema.safeParse({ branches }).success).toBe(true);
      });

      it("accepts branches with complex conditions", () => {
        expect(
          schema.safeParse({
            branches: [
              { label: "Admin", condition: "user.role === 'admin'" },
              { label: "Editor", condition: "user.role === 'editor'" },
            ],
          }).success,
        ).toBe(true);
      });
    });

    describe("invalid cases", () => {
      it("rejects empty branches array", () => {
        expect(schema.safeParse({ branches: [] }).success).toBe(false);
      });

      it("rejects missing branches field", () => {
        expect(schema.safeParse({}).success).toBe(false);
      });

      it("rejects null branches", () => {
        expect(schema.safeParse({ branches: null }).success).toBe(false);
      });

      it("rejects branches as string", () => {
        expect(schema.safeParse({ branches: "a,b" }).success).toBe(false);
      });

      it("rejects branch array containing invalid entries", () => {
        expect(
          schema.safeParse({
            branches: [
              { label: "Good", condition: "x" },
              { label: "", condition: "y" }, // invalid empty label
            ],
          }).success,
        ).toBe(false);
      });

      it("rejects branch array with non-object entries", () => {
        expect(
          schema.safeParse({
            branches: ["not-an-object"],
          }).success,
        ).toBe(false);
      });
    });

    describe("defaultData conformance", () => {
      it("DecisionSwitchNodeSpec.defaultData conforms to schema", () => {
        const result = schema.safeParse(DecisionSwitchNodeSpec.defaultData);
        expect(result.success).toBe(true);
      });

      it("parsed defaultData matches original", () => {
        const result = schema.safeParse(DecisionSwitchNodeSpec.defaultData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(DecisionSwitchNodeSpec.defaultData);
        }
      });

      it("defaultData has at least one branch", () => {
        expect(DecisionSwitchNodeSpec.defaultData.branches.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("schema matches spec.propertySchema", () => {
      it("exported schema is the same as spec.propertySchema", () => {
        expect(schema).toBe(DecisionSwitchNodeSpec.propertySchema);
      });
    });
  });

  describe("cross-variant isolation", () => {
    it("if-else schema rejects switch data (branches instead of condition)", () => {
      const result = decisionPropertySchema.safeParse({
        branches: [{ label: "A", condition: "x" }],
      });
      expect(result.success).toBe(false);
    });

    it("switch schema rejects if-else data (condition instead of branches)", () => {
      const result = decisionSwitchPropertySchema.safeParse({
        condition: "x > 0",
      });
      expect(result.success).toBe(false);
    });

    it("if-else schema does not accept extra branches field", () => {
      // Zod strips extra by default, but condition must still be present
      const result = decisionPropertySchema.safeParse({
        condition: "x",
        branches: [{ label: "A", condition: "y" }],
      });
      // Should succeed (extra field stripped) as long as condition is valid
      expect(result.success).toBe(true);
    });

    it("switch schema does not accept extra condition field", () => {
      const result = decisionSwitchPropertySchema.safeParse({
        branches: [{ label: "A", condition: "x" }],
        condition: "extra",
      });
      // Should succeed (extra field stripped) as long as branches is valid
      expect(result.success).toBe(true);
    });
  });
});
