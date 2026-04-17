import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { UnknownNodeKindError } from "@/domain/validation/errors";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const emptySchema = z.object({});

function makeSpec(kind: string): NodeSpec {
  return {
    kind,
    category: "test",
    label: kind,
    icon: "box",
    ports: [
      makeInputPort({ id: "in", label: "In", dataType: "any" }),
      makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
    ],
    propertySchema: emptySchema,
    defaultData: {},
    capabilities: [],
  };
}

describe("NodeRegistry", () => {
  describe("register", () => {
    it("registers a spec successfully", () => {
      const registry = new NodeRegistry();
      const spec = makeSpec("task");
      registry.register(spec);
      expect(registry.resolve("task")).toBe(spec);
    });

    it("throws on duplicate kind registration", () => {
      const registry = new NodeRegistry();
      registry.register(makeSpec("task"));
      expect(() => {
        registry.register(makeSpec("task"));
      }).toThrow("Duplicate node kind");
      expect(() => {
        registry.register(makeSpec("task"));
      }).toThrow('"task"');
    });
  });

  describe("resolve", () => {
    it("returns the registered spec for a known kind", () => {
      const registry = new NodeRegistry();
      const spec = makeSpec("start");
      registry.register(spec);
      expect(registry.resolve("start")).toBe(spec);
    });

    it("throws UnknownNodeKindError for unregistered kind", () => {
      const registry = new NodeRegistry();
      expect(() => registry.resolve("missing")).toThrow(UnknownNodeKindError);
    });

    it("UnknownNodeKindError carries the kind in details and message", () => {
      const registry = new NodeRegistry();
      try {
        registry.resolve("phantom");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(UnknownNodeKindError);
        expect((err as UnknownNodeKindError).code).toBe("UNKNOWN_NODE_KIND");
        expect((err as UnknownNodeKindError).message).toContain('"phantom"');
        expect((err as UnknownNodeKindError).details).toHaveProperty("kind", "phantom");
      }
    });
  });

  describe("list", () => {
    it("returns empty array when no specs registered", () => {
      const registry = new NodeRegistry();
      expect(registry.list()).toEqual([]);
    });

    it("returns all registered specs", () => {
      const registry = new NodeRegistry();
      const start = makeSpec("start");
      const end = makeSpec("end");
      const task = makeSpec("task");
      registry.register(start);
      registry.register(end);
      registry.register(task);

      const listed = registry.list();
      expect(listed).toHaveLength(3);
      expect(listed).toContain(start);
      expect(listed).toContain(end);
      expect(listed).toContain(task);
    });

    it("returns a new array copy each call", () => {
      const registry = new NodeRegistry();
      registry.register(makeSpec("task"));
      const a = registry.list();
      const b = registry.list();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe("freeze", () => {
    it("prevents further registration after freeze", () => {
      const registry = new NodeRegistry();
      registry.register(makeSpec("start"));
      registry.freeze();
      expect(() => {
        registry.register(makeSpec("end"));
      }).toThrow("frozen");
      expect(() => {
        registry.register(makeSpec("end"));
      }).toThrow('"end"');
    });

    it("allows resolve and list after freeze", () => {
      const registry = new NodeRegistry();
      const spec = makeSpec("task");
      registry.register(spec);
      registry.freeze();

      expect(registry.resolve("task")).toBe(spec);
      expect(registry.list()).toHaveLength(1);
    });

    it("calling freeze multiple times is idempotent", () => {
      const registry = new NodeRegistry();
      registry.register(makeSpec("start"));
      registry.freeze();
      registry.freeze();
      expect(() => {
        registry.register(makeSpec("end"));
      }).toThrow("frozen");
    });
  });

  describe("has", () => {
    it("returns true for a registered kind", () => {
      const registry = new NodeRegistry();
      registry.register(makeSpec("task"));
      expect(registry.has("task")).toBe(true);
    });

    it("returns false for an unregistered kind", () => {
      const registry = new NodeRegistry();
      expect(registry.has("missing")).toBe(false);
    });
  });
});
