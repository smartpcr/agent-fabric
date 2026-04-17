import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateNodeData } from "@/domain/validation/validators";
import { makeNode } from "@/domain/models/node";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { makeOutputPort } from "@/domain/models/port";

function spec<TData>(schema: z.ZodType<TData>, defaultData: TData): NodeSpec<TData> {
  return {
    kind: "test",
    category: "test",
    label: "Test",
    icon: "box",
    ports: [makeOutputPort({ id: "out", label: "Out" })],
    propertySchema: schema,
    defaultData,
    capabilities: [],
  };
}

describe("validateNodeData", () => {
  // Valid data passes
  it("returns empty array for valid node data", () => {
    const schema = z.object({ name: z.string(), count: z.number() });
    const s = spec(schema, { name: "default", count: 0 });
    const node = makeNode({ kind: "test", data: { name: "hello", count: 42 } });

    const errors = validateNodeData(node, s);
    expect(errors).toEqual([]);
  });

  // Single error
  it("returns a single error for one invalid field", () => {
    const schema = z.object({ name: z.string() });
    const s = spec(schema, { name: "default" });
    const node = makeNode({ kind: "test", data: { name: 123 } });

    const errors = validateNodeData(node, s);
    expect(errors.length).toBe(1);
    expect(errors[0].path).toBe("name");
    expect(errors[0].message).toBeTruthy();
  });

  // Multiple errors aggregate
  it("aggregates multiple errors from different fields", () => {
    const schema = z.object({
      name: z.string(),
      count: z.number(),
      active: z.literal(true).or(z.literal(false)),
    });
    const s = spec(schema, { name: "d", count: 0, active: true as true | false });
    const node = makeNode({ kind: "test", data: { name: 123, count: "bad", active: "nope" } });

    const errors = validateNodeData(node, s);
    expect(errors.length).toBe(3);
    const paths = errors.map((e) => e.path);
    expect(paths).toContain("name");
    expect(paths).toContain("count");
    expect(paths).toContain("active");
  });

  // Deeply nested paths formatted as a.b[0].c
  it("formats deeply nested paths as a.b[0].c", () => {
    const schema = z.object({
      a: z.object({
        b: z.array(z.object({ c: z.string() })),
      }),
    });
    const s = spec(schema, { a: { b: [{ c: "ok" }] } });
    const node = makeNode({
      kind: "test",
      data: { a: { b: [{ c: 999 }] } },
    });

    const errors = validateNodeData(node, s);
    expect(errors.length).toBe(1);
    expect(errors[0].path).toBe("a.b[0].c");
  });

  // Root-level error (no path segments)
  it("handles root-level validation error with empty path", () => {
    const schema = z.string();
    const s = spec(schema, "default" as unknown);
    const node = makeNode({ kind: "test", data: 42 });

    const errors = validateNodeData(node, s);
    expect(errors.length).toBe(1);
    expect(errors[0].path).toBe("");
  });

  // Array index path formatting
  it("formats array-only paths correctly", () => {
    const schema = z.array(z.string());
    const s = spec(schema, ["ok"] as unknown);
    const node = makeNode({ kind: "test", data: [123] });

    const errors = validateNodeData(node, s);
    expect(errors.length).toBe(1);
    expect(errors[0].path).toBe("[0]");
  });

  // Each error has a message
  it("each error has a non-empty message", () => {
    const schema = z.object({ x: z.number().min(10), y: z.number().max(5) });
    const s = spec(schema, { x: 10, y: 5 });
    const node = makeNode({ kind: "test", data: { x: 1, y: 100 } });

    const errors = validateNodeData(node, s);
    expect(errors.length).toBe(2);
    for (const error of errors) {
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
