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

  it("resolves every EdgeKind to a renderable component", () => {
    const kinds: EdgeKind[] = ["default", "loop-back", "conditional"];
    for (const kind of kinds) {
      const component = edgeTypes[kind];
      expect(component).toBeDefined();
      // React.memo components have $$typeof; plain components are functions.
      // Both are valid React component types that ReactFlow can render.
      const memoSymbol = Symbol.for("react.memo");
      const hasType = (component as unknown as { $$typeof?: symbol }).$$typeof === memoSymbol;
      expect(typeof component === "function" || hasType).toBe(true);
    }
  });

  it("does not resolve unknown kind", () => {
    expect(edgeTypes.nonexistent).toBeUndefined();
  });
});
