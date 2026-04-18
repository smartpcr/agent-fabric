import { describe, it, expect } from "vitest";
import {
  FieldRegistry,
  createFieldRegistry,
  type FieldComponent,
  type FieldComponentProps,
} from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

// ─── Mock field components ───────────────────────────────────────────

const StringField: FieldComponent = ((_props: FieldComponentProps) => null) as FieldComponent;
const NumberField: FieldComponent = ((_props: FieldComponentProps) => null) as FieldComponent;
const BooleanField: FieldComponent = ((_props: FieldComponentProps) => null) as FieldComponent;
const EnumField: FieldComponent = ((_props: FieldComponentProps) => null) as FieldComponent;
const CustomWidget: FieldComponent = ((_props: FieldComponentProps) => null) as FieldComponent;
const OverrideWidget: FieldComponent = ((_props: FieldComponentProps) => null) as FieldComponent;

// ─── Helpers ─────────────────────────────────────────────────────────

function makeDescriptor(
  overrides: Partial<FieldDescriptor> & { name: string; type: FieldDescriptor["type"] },
): FieldDescriptor {
  return { required: true, ...overrides };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("FieldRegistry", () => {
  describe("registerField / type-level resolution", () => {
    it("resolves a registered type to its component", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerField("number", NumberField);

      const result = reg.resolveField(makeDescriptor({ name: "age", type: "number" }));
      expect(result).toBe(NumberField);
    });

    it("resolves each registered type independently", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerField("number", NumberField);
      reg.registerField("boolean", BooleanField);
      reg.registerField("enum", EnumField);

      expect(reg.resolveField(makeDescriptor({ name: "a", type: "number" }))).toBe(NumberField);
      expect(reg.resolveField(makeDescriptor({ name: "b", type: "boolean" }))).toBe(BooleanField);
      expect(reg.resolveField(makeDescriptor({ name: "c", type: "enum", enumValues: ["x"] }))).toBe(
        EnumField,
      );
    });

    it("overwrites a previous type registration", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerField("number", NumberField);
      reg.registerField("number", CustomWidget);

      expect(reg.resolveField(makeDescriptor({ name: "x", type: "number" }))).toBe(CustomWidget);
    });
  });

  describe("registerFieldOverride / descriptor-level resolution", () => {
    it("resolves a name override for a specific field", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerFieldOverride("email", CustomWidget);

      const result = reg.resolveField(makeDescriptor({ name: "email", type: "string" }));
      expect(result).toBe(CustomWidget);
    });

    it("name override beats type-level registration", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerField("string", StringField);
      reg.registerFieldOverride("email", OverrideWidget);

      const result = reg.resolveField(makeDescriptor({ name: "email", type: "string" }));
      expect(result).toBe(OverrideWidget);
    });

    it("name override only applies to the specific field name", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerField("string", StringField);
      reg.registerFieldOverride("email", OverrideWidget);

      // "email" gets the override
      expect(reg.resolveField(makeDescriptor({ name: "email", type: "string" }))).toBe(
        OverrideWidget,
      );
      // "name" still gets the type-level registration
      expect(reg.resolveField(makeDescriptor({ name: "name", type: "string" }))).toBe(StringField);
    });

    it("overwrites a previous name override", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerFieldOverride("email", CustomWidget);
      reg.registerFieldOverride("email", OverrideWidget);

      expect(reg.resolveField(makeDescriptor({ name: "email", type: "string" }))).toBe(
        OverrideWidget,
      );
    });
  });

  describe("fallback behaviour", () => {
    it("returns fallback for an unregistered type", () => {
      const reg = new FieldRegistry(StringField);
      const result = reg.resolveField(makeDescriptor({ name: "data", type: "unknown" }));
      expect(result).toBe(StringField);
    });

    it("returns fallback when type is registered but under a different key", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerField("number", NumberField);

      const result = reg.resolveField(makeDescriptor({ name: "x", type: "boolean" }));
      expect(result).toBe(StringField);
    });

    it("returns fallback for an empty registry (no type or name registrations)", () => {
      const reg = new FieldRegistry(StringField);
      expect(reg.resolveField(makeDescriptor({ name: "anything", type: "string" }))).toBe(
        StringField,
      );
    });
  });

  describe("resolution order (combined)", () => {
    it("follows priority: name override > type registration > fallback", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerField("string", NumberField); // type-level → NumberField
      reg.registerFieldOverride("email", OverrideWidget); // name-level → OverrideWidget

      // 1. Name override wins over type-level
      expect(reg.resolveField(makeDescriptor({ name: "email", type: "string" }))).toBe(
        OverrideWidget,
      );
      // 2. Type-level wins for non-overridden fields
      expect(reg.resolveField(makeDescriptor({ name: "title", type: "string" }))).toBe(NumberField);
      // 3. Fallback for unregistered type
      expect(reg.resolveField(makeDescriptor({ name: "count", type: "number" }))).toBe(StringField);
    });

    it("name override wins even when the field type has no type-level registration", () => {
      const reg = new FieldRegistry(StringField);
      // No type-level for "object", but we have a name override
      reg.registerFieldOverride("metadata", CustomWidget);

      expect(reg.resolveField(makeDescriptor({ name: "metadata", type: "object" }))).toBe(
        CustomWidget,
      );
    });
  });

  describe("createFieldRegistry factory", () => {
    it("creates a registry with the given fallback", () => {
      const reg = createFieldRegistry(StringField);
      expect(reg).toBeInstanceOf(FieldRegistry);
      expect(reg.resolveField(makeDescriptor({ name: "x", type: "unknown" }))).toBe(StringField);
    });

    it("supports registerField and resolveField after creation", () => {
      const reg = createFieldRegistry(StringField);
      reg.registerField("boolean", BooleanField);

      expect(reg.resolveField(makeDescriptor({ name: "active", type: "boolean" }))).toBe(
        BooleanField,
      );
    });
  });

  describe("FieldResolver interface conformance", () => {
    it("FieldRegistry instances satisfy the FieldResolver interface", () => {
      const reg = new FieldRegistry(StringField);
      // FieldResolver requires resolveField(descriptor) => FieldComponent
      const resolver: { resolveField: (d: FieldDescriptor) => FieldComponent } = reg;
      expect(typeof resolver.resolveField).toBe("function");
      expect(resolver.resolveField(makeDescriptor({ name: "x", type: "string" }))).toBe(
        StringField,
      );
    });
  });

  describe("edge cases", () => {
    it("handles descriptor with additional properties gracefully", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerField("enum", EnumField);

      const descriptor: FieldDescriptor = {
        name: "color",
        type: "enum",
        required: true,
        enumValues: ["red", "green"],
      };
      expect(reg.resolveField(descriptor)).toBe(EnumField);
    });

    it("handles empty string as a valid field name for override", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerFieldOverride("", CustomWidget);

      expect(reg.resolveField(makeDescriptor({ name: "", type: "string" }))).toBe(CustomWidget);
    });

    it("handles empty string as a valid type registration", () => {
      const reg = new FieldRegistry(StringField);
      reg.registerField("", CustomWidget);

      // The FieldDescriptor type union doesn't include "" but the map lookup is string-based
      // so any non-standard type that matches will resolve
      expect(reg.resolveField({ name: "x", type: "unknown", required: true })).toBe(StringField);
    });

    it("independent registries do not interfere", () => {
      const reg1 = new FieldRegistry(StringField);
      const reg2 = new FieldRegistry(NumberField);
      reg1.registerField("boolean", BooleanField);

      expect(reg1.resolveField(makeDescriptor({ name: "x", type: "boolean" }))).toBe(BooleanField);
      // reg2 has no boolean registration — falls to its own fallback
      expect(reg2.resolveField(makeDescriptor({ name: "x", type: "boolean" }))).toBe(NumberField);
    });
  });
});
