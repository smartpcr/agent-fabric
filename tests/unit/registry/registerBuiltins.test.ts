import { describe, it, expect } from "vitest";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";

describe("registerBuiltins", () => {
  it("registers start, end, and task kinds", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);

    const kinds = registry.list().map((s) => s.kind);
    expect(kinds).toContain("start");
    expect(kinds).toContain("end");
    expect(kinds).toContain("task");
    expect(kinds).toHaveLength(3);
  });

  it("second call is a no-op (idempotent)", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    registerBuiltins(registry);

    expect(registry.list()).toHaveLength(3);
  });

  it("does not throw on second call", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    expect(() => {
      registerBuiltins(registry);
    }).not.toThrow();
  });

  it("preserves existing specs from first call", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    const first = registry.resolve("start");
    registerBuiltins(registry);
    expect(registry.resolve("start")).toBe(first);
  });

  it("registers into a registry that already has some builtins", () => {
    const registry = new NodeRegistry();
    registry.register({
      kind: "start",
      category: "custom",
      label: "S",
      icon: "x",
      ports: [],
      propertySchema: { safeParse: () => ({ success: true }) } as never,
      defaultData: {},
      capabilities: [],
    });
    registerBuiltins(registry);

    const kinds = registry.list().map((s) => s.kind);
    expect(kinds).toContain("start");
    expect(kinds).toContain("end");
    expect(kinds).toContain("task");
    expect(kinds).toHaveLength(3);
  });
});
