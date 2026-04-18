import { describe, it, expect } from "vitest";
import { z } from "zod";
import { introspect } from "@/features/property-grid/introspect";

describe("introspect", () => {
  // ─── Primitives ──────────────────────────────────────────────────

  describe("ZodString", () => {
    it("produces a string descriptor", () => {
      const schema = z.object({ name: z.string() });
      const fields = introspect(schema);

      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        name: "name",
        type: "string",
        required: true,
      });
    });

    it("preserves constraints metadata without breaking introspection", () => {
      const schema = z.object({ title: z.string().min(1).max(100) });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("string");
      expect(fields[0]?.required).toBe(true);
    });
  });

  describe("ZodNumber", () => {
    it("produces a number descriptor", () => {
      const schema = z.object({ age: z.number() });
      const fields = introspect(schema);

      expect(fields[0]).toMatchObject({
        name: "age",
        type: "number",
        required: true,
      });
    });

    it("handles constrained numbers", () => {
      const schema = z.object({ count: z.number()["int"]().min(0) });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("number");
    });
  });

  describe("ZodBoolean", () => {
    it("produces a boolean descriptor", () => {
      const schema = z.object({ active: z["boolean"]() });
      const fields = introspect(schema);

      expect(fields[0]).toMatchObject({
        name: "active",
        type: "boolean",
        required: true,
      });
    });
  });

  describe("ZodEnum", () => {
    it("produces an enum descriptor with values", () => {
      const schema = z.object({ color: z["enum"](["red", "green", "blue"]) });
      const fields = introspect(schema);

      expect(fields[0]).toMatchObject({
        name: "color",
        type: "enum",
        required: true,
      });
      expect(fields[0]?.enumValues).toEqual(["red", "green", "blue"]);
    });

    it("handles single-value enums", () => {
      const schema = z.object({ status: z["enum"](["active"]) });
      const fields = introspect(schema);

      expect(fields[0]?.enumValues).toEqual(["active"]);
    });
  });

  // ─── Wrappers ────────────────────────────────────────────────────

  describe("ZodOptional", () => {
    it("unwraps optional and marks required=false", () => {
      const schema = z.object({ label: z.string().optional() });
      const fields = introspect(schema);

      expect(fields[0]).toMatchObject({
        name: "label",
        type: "string",
        required: false,
      });
    });

    it("unwraps optional on number", () => {
      const schema = z.object({ count: z.number().optional() });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("number");
      expect(fields[0]?.required).toBe(false);
    });

    it("unwraps optional on boolean", () => {
      const schema = z.object({ flag: z["boolean"]().optional() });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("boolean");
      expect(fields[0]?.required).toBe(false);
    });

    it("unwraps optional on enum", () => {
      const schema = z.object({ color: z["enum"](["red", "blue"]).optional() });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("enum");
      expect(fields[0]?.required).toBe(false);
      expect(fields[0]?.enumValues).toEqual(["red", "blue"]);
    });
  });

  describe("ZodDefault", () => {
    it("unwraps default, marks required=false, captures defaultValue", () => {
      const schema = z.object({ count: z.number()["default"](42) });
      const fields = introspect(schema);

      expect(fields[0]).toMatchObject({
        name: "count",
        type: "number",
        required: false,
        defaultValue: 42,
      });
    });

    it("unwraps default on string", () => {
      const schema = z.object({ name: z.string()["default"]("untitled") });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("string");
      expect(fields[0]?.defaultValue).toBe("untitled");
    });

    it("unwraps default on boolean", () => {
      const schema = z.object({ enabled: z["boolean"]()["default"](true) });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("boolean");
      expect(fields[0]?.defaultValue).toBe(true);
    });

    it("handles optional wrapping default", () => {
      const schema = z.object({ value: z.number()["default"](0).optional() });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("number");
      expect(fields[0]?.required).toBe(false);
    });
  });

  // ─── Compound types ──────────────────────────────────────────────

  describe("ZodObject", () => {
    it("produces an object descriptor with children", () => {
      const schema = z.object({
        address: z.object({
          street: z.string(),
          city: z.string(),
        }),
      });
      const fields = introspect(schema);

      expect(fields[0]).toMatchObject({
        name: "address",
        type: "object",
        required: true,
      });
      expect(fields[0]?.children).toHaveLength(2);
      expect(fields[0]?.children?.[0]?.name).toBe("street");
      expect(fields[0]?.children?.[1]?.name).toBe("city");
    });

    it("handles deeply nested objects", () => {
      const schema = z.object({
        a: z.object({
          b: z.object({
            c: z.number(),
          }),
        }),
      });

      const fields = introspect(schema);
      expect(fields[0]?.children?.[0]?.children?.[0]?.name).toBe("c");
      expect(fields[0]?.children?.[0]?.children?.[0]?.type).toBe("number");
    });

    it("handles optional nested objects", () => {
      const schema = z.object({
        meta: z
          .object({
            tags: z.string(),
          })
          .optional(),
      });

      const fields = introspect(schema);
      expect(fields[0]?.type).toBe("object");
      expect(fields[0]?.required).toBe(false);
      expect(fields[0]?.children?.[0]?.name).toBe("tags");
    });

    it("returns empty children for empty nested objects", () => {
      const schema = z.object({ empty: z.object({}) });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("object");
      expect(fields[0]?.children).toBeUndefined();
    });
  });

  describe("ZodArray", () => {
    it("produces an array descriptor with elementType", () => {
      const schema = z.object({ tags: z.array(z.string()) });
      const fields = introspect(schema);

      expect(fields[0]).toMatchObject({
        name: "tags",
        type: "array",
        required: true,
      });
      expect(fields[0]?.elementType).toMatchObject({
        name: "element",
        type: "string",
      });
    });

    it("handles arrays of numbers", () => {
      const schema = z.object({ scores: z.array(z.number()) });
      const fields = introspect(schema);

      expect(fields[0]?.elementType?.type).toBe("number");
    });

    it("handles arrays of objects", () => {
      const schema = z.object({
        items: z.array(
          z.object({
            id: z.number(),
            label: z.string(),
          }),
        ),
      });
      const fields = introspect(schema);

      expect(fields[0]?.elementType?.type).toBe("object");
      expect(fields[0]?.elementType?.children).toHaveLength(2);
    });

    it("handles optional arrays", () => {
      const schema = z.object({ items: z.array(z.string()).optional() });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("array");
      expect(fields[0]?.required).toBe(false);
      expect(fields[0]?.elementType?.type).toBe("string");
    });
  });

  describe("ZodRecord", () => {
    it("produces a record descriptor with valueType", () => {
      const schema = z.object({ params: z.record(z.string(), z.number()) });
      const fields = introspect(schema);

      expect(fields[0]).toMatchObject({
        name: "params",
        type: "record",
        required: true,
      });
      expect(fields[0]?.valueType).toMatchObject({
        name: "value",
        type: "number",
      });
    });

    it("handles records with string values", () => {
      const schema = z.object({ env: z.record(z.string(), z.string()) });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("record");
      expect(fields[0]?.valueType?.type).toBe("string");
    });

    it("handles records with object values", () => {
      const schema = z.object({
        config: z.record(
          z.string(),
          z.object({
            enabled: z["boolean"](),
            value: z.number(),
          }),
        ),
      });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("record");
      expect(fields[0]?.valueType?.type).toBe("object");
      expect(fields[0]?.valueType?.children).toHaveLength(2);
    });

    it("handles optional records", () => {
      const schema = z.object({
        metadata: z.record(z.string(), z.string()).optional(),
      });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("record");
      expect(fields[0]?.required).toBe(false);
    });

    it("handles records with unknown values", () => {
      const schema = z.object({ data: z.record(z.string(), z.unknown()) });
      const fields = introspect(schema);

      expect(fields[0]?.type).toBe("record");
      expect(fields[0]?.valueType?.type).toBe("unknown");
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns empty array for non-object schemas", () => {
      expect(introspect(z.string())).toEqual([]);
      expect(introspect(z.number())).toEqual([]);
      expect(introspect(z["boolean"]())).toEqual([]);
      expect(introspect(z.array(z.string()))).toEqual([]);
    });

    it("returns empty array for empty object schemas", () => {
      expect(introspect(z.object({}))).toEqual([]);
    });

    it("handles mixed field types in one schema", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z["boolean"](),
        role: z["enum"](["admin", "user"]),
        address: z.object({ city: z.string() }),
        tags: z.array(z.string()),
        params: z.record(z.string(), z.unknown()),
        label: z.string().optional(),
        count: z.number()["default"](0),
      });

      const fields = introspect(schema);
      expect(fields).toHaveLength(9);

      const typeMap = Object.fromEntries(fields.map((f) => [f.name, f.type]));
      expect(typeMap).toEqual({
        name: "string",
        age: "number",
        active: "boolean",
        role: "enum",
        address: "object",
        tags: "array",
        params: "record",
        label: "string",
        count: "number",
      });

      // Check individual field details
      const label = fields.find((f) => f.name === "label");
      expect(label?.required).toBe(false);

      const count = fields.find((f) => f.name === "count");
      expect(count?.required).toBe(false);
      expect(count?.defaultValue).toBe(0);

      const role = fields.find((f) => f.name === "role");
      expect(role?.enumValues).toEqual(["admin", "user"]);

      const address = fields.find((f) => f.name === "address");
      expect(address?.children).toHaveLength(1);

      const tags = fields.find((f) => f.name === "tags");
      expect(tags?.elementType?.type).toBe("string");

      const params = fields.find((f) => f.name === "params");
      expect(params?.valueType?.type).toBe("unknown");
    });
  });
});
