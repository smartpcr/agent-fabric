import { describe, it, expect } from "vitest";
import { edgeTypes } from "@/features/canvas/edgeTypes";
import { DefaultEdge } from "@/features/edges/DefaultEdge";
import { ConditionalEdge } from "@/features/edges/ConditionalEdge";
import { LoopBackEdge } from "@/features/edges/LoopBackEdge";
import type { EdgeKind } from "@/domain/models/edge";

describe("edgeTypes", () => {
  it("exports exactly three edge type entries", () => {
    expect(Object.keys(edgeTypes)).toHaveLength(3);
  });

  it("maps 'default' to DefaultEdge", () => {
    expect(edgeTypes["default"]).toBe(DefaultEdge);
  });

  it("maps 'loop-back' to LoopBackEdge", () => {
    expect(edgeTypes["loop-back"]).toBe(LoopBackEdge);
  });

  it("maps 'conditional' to ConditionalEdge", () => {
    expect(edgeTypes.conditional).toBe(ConditionalEdge);
  });

  it("resolves every EdgeKind to a component", () => {
    const kinds: EdgeKind[] = ["default", "loop-back", "conditional"];
    for (const kind of kinds) {
      expect(edgeTypes[kind]).toBeDefined();
      expect(typeof edgeTypes[kind]).toBe("function");
    }
  });

  it("does not resolve unknown kind", () => {
    expect(edgeTypes.nonexistent).toBeUndefined();
  });
});
