import { describe, it, expect } from "vitest";
import { GraphJsonV1 } from "@/domain/serialization/schema.v1";

function validPayload() {
  return {
    schemaVersion: 1 as const,
    id: "graph-1",
    name: "Test Graph",
    nodes: [
      { id: "n1", kind: "start", position: { x: 0, y: 0 }, data: {} },
      { id: "n2", kind: "task", position: { x: 100, y: 0 }, data: { name: "Do stuff" } },
      { id: "n3", kind: "end", position: { x: 200, y: 0 }, data: {} },
    ],
    edges: [
      {
        id: "e1",
        source: "n1",
        sourcePort: "out",
        target: "n2",
        targetPort: "in",
        kind: "default" as const,
      },
      {
        id: "e2",
        source: "n2",
        sourcePort: "out",
        target: "n3",
        targetPort: "in",
        kind: "default" as const,
      },
    ],
  };
}

describe("GraphJsonV1 schema", () => {
  it("accepts a valid complete payload", () => {
    const result = GraphJsonV1.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("accepts a payload with empty nodes and edges", () => {
    const result = GraphJsonV1.safeParse({
      schemaVersion: 1,
      id: "g1",
      name: "Empty",
      nodes: [],
      edges: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an edge with optional label and condition", () => {
    const payload = validPayload();
    payload.edges[0] = { ...payload.edges[0], label: "yes", condition: "x > 0" };
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("accepts an edge with kind loop-back", () => {
    const payload = validPayload();
    payload.edges[0] = { ...payload.edges[0], kind: "loop-back" };
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("accepts a node with arbitrary data", () => {
    const payload = validPayload();
    payload.nodes[0] = { ...payload.nodes[0], data: { nested: { arr: [1, 2] } } };
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(true);
  });

  // Rejection tests

  it("rejects wrong schemaVersion (2)", () => {
    const payload = { ...validPayload(), schemaVersion: 2 };
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects wrong schemaVersion (0)", () => {
    const payload = { ...validPayload(), schemaVersion: 0 };
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects wrong schemaVersion (string)", () => {
    const payload = { ...validPayload(), schemaVersion: "1" };
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects missing schemaVersion", () => {
    const { schemaVersion: _, ...rest } = validPayload();
    const result = GraphJsonV1.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing id", () => {
    const { id: _, ...rest } = validPayload();
    const result = GraphJsonV1.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name: _, ...rest } = validPayload();
    const result = GraphJsonV1.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing nodes", () => {
    const { nodes: _, ...rest } = validPayload();
    const result = GraphJsonV1.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing edges", () => {
    const { edges: _, ...rest } = validPayload();
    const result = GraphJsonV1.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a node missing id", () => {
    const payload = validPayload();
    const { id: _, ...badNode } = payload.nodes[0];
    payload.nodes[0] = badNode as (typeof payload.nodes)[0];
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects a node missing kind", () => {
    const payload = validPayload();
    const { kind: _, ...badNode } = payload.nodes[0];
    payload.nodes[0] = badNode as (typeof payload.nodes)[0];
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects a node missing position", () => {
    const payload = validPayload();
    const { position: _, ...badNode } = payload.nodes[0];
    payload.nodes[0] = badNode as (typeof payload.nodes)[0];
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects an edge missing source", () => {
    const payload = validPayload();
    const { source: _, ...badEdge } = payload.edges[0];
    payload.edges[0] = badEdge as (typeof payload.edges)[0];
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects an edge with invalid kind", () => {
    const payload = validPayload();
    payload.edges[0] = { ...payload.edges[0], kind: "unknown" as "default" };
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects an edge missing kind", () => {
    const payload = validPayload();
    const { kind: _, ...badEdge } = payload.edges[0];
    payload.edges[0] = badEdge as (typeof payload.edges)[0];
    const result = GraphJsonV1.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
