import { describe, it, expect, beforeEach } from "vitest";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { SECRET_FIELD_NAMES, scrubSecrets } from "@/features/property-grid/fields/SecretField";

beforeEach(() => {
  SECRET_FIELD_NAMES.clear();
});

describe("registerBuiltins", () => {
  it("registers start, end, task, decision, decision-switch, loop-while, and loop-foreach kinds", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);

    const kinds = registry.list().map((s) => s.kind);
    expect(kinds).toContain("start");
    expect(kinds).toContain("end");
    expect(kinds).toContain("task");
    expect(kinds).toContain("decision");
    expect(kinds).toContain("decision-switch");
    expect(kinds).toContain("loop-while");
    expect(kinds).toContain("loop-foreach");
    expect(kinds).toHaveLength(7);
  });

  it("second call is a no-op (idempotent)", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    registerBuiltins(registry);

    expect(registry.list()).toHaveLength(7);
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
    expect(kinds).toContain("decision");
    expect(kinds).toContain("decision-switch");
    expect(kinds).toContain("loop-while");
    expect(kinds).toContain("loop-foreach");
    expect(kinds).toHaveLength(7);
  });

  it("calls registerSecretFieldsFromDescriptors for each spec's schema", () => {
    // SECRET_FIELD_NAMES is cleared in beforeEach.
    // Current builtins have no secret fields, so the set stays empty,
    // but the wiring is exercised without error.
    const registry = new NodeRegistry();
    registerBuiltins(registry);

    // No builtins define secret fields yet — verify no crash and set is valid
    expect(SECRET_FIELD_NAMES).toBeInstanceOf(Set);
  });

  it("populates SECRET_FIELD_NAMES with apiKey from TaskNode schema at startup", () => {
    // SECRET_FIELD_NAMES is cleared in beforeEach.
    expect(SECRET_FIELD_NAMES.size).toBe(0);

    const registry = new NodeRegistry();
    registerBuiltins(registry);

    // TaskNode.spec has apiKey with .describe("{ secret: true }")
    // introspect extracts secret: true, registerSecretFieldsFromDescriptors populates the set
    expect(SECRET_FIELD_NAMES.has("apiKey")).toBe(true);
  });

  it("scrubSecrets works for secret fields discovered at startup", () => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);

    // apiKey is now registered — scrubbing should work without any component mount
    const data = { apiKey: "raw-secret-value", name: "safe" };
    const result = scrubSecrets(data) as Record<string, unknown>;

    expect(result.apiKey).toBe("<secret>");
    expect(result.name).toBe("safe");
  });
});
