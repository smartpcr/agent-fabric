import { describe, it, expect } from "vitest";
import {
  getLoopBackOptions,
  getLayoutOptionsWithLoopBack,
  getLayoutOptions,
  type LayoutStrategy,
} from "@/domain/layout/layoutOptions";

describe("getLoopBackOptions", () => {
  it("includes edgeRouting ORTHOGONAL", () => {
    const opts = getLoopBackOptions();
    expect(opts["org.eclipse.elk.edgeRouting"]).toBe("ORTHOGONAL");
  });

  it("includes cycleBreaking.strategy GREEDY", () => {
    const opts = getLoopBackOptions();
    expect(opts["org.eclipse.elk.layered.cycleBreaking.strategy"]).toBe("GREEDY");
  });

  it("includes considerModelOrder.strategy NODES_AND_EDGES", () => {
    const opts = getLoopBackOptions();
    expect(opts["org.eclipse.elk.layered.considerModelOrder.strategy"]).toBe("NODES_AND_EDGES");
  });

  it("contains exactly the three loop-relevant keys", () => {
    const opts = getLoopBackOptions();
    expect(Object.keys(opts)).toHaveLength(3);
    expect(Object.keys(opts).sort()).toEqual([
      "org.eclipse.elk.edgeRouting",
      "org.eclipse.elk.layered.considerModelOrder.strategy",
      "org.eclipse.elk.layered.cycleBreaking.strategy",
    ]);
  });

  it("returns a fresh copy each call", () => {
    const a = getLoopBackOptions();
    const b = getLoopBackOptions();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe("getLayoutOptionsWithLoopBack", () => {
  it("defaults to layered strategy", () => {
    const opts = getLayoutOptionsWithLoopBack();
    expect(opts["org.eclipse.elk.algorithm"]).toBe("org.eclipse.elk.layered");
  });

  it("merges loop-back keys into layered options", () => {
    const opts = getLayoutOptionsWithLoopBack("layered");
    expect(opts["org.eclipse.elk.algorithm"]).toBe("org.eclipse.elk.layered");
    expect(opts["org.eclipse.elk.edgeRouting"]).toBe("ORTHOGONAL");
    expect(opts["org.eclipse.elk.layered.cycleBreaking.strategy"]).toBe("GREEDY");
    expect(opts["org.eclipse.elk.layered.considerModelOrder.strategy"]).toBe("NODES_AND_EDGES");
  });

  it("preserves layered-specific keys alongside loop-back keys", () => {
    const opts = getLayoutOptionsWithLoopBack("layered");
    expect(opts["org.eclipse.elk.direction"]).toBe("RIGHT");
    expect(opts["org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers"]).toBe("60");
  });

  it("preserves common spacing options", () => {
    const opts = getLayoutOptionsWithLoopBack("layered");
    expect(opts["org.eclipse.elk.spacing.nodeNode"]).toBe("40");
    expect(opts["org.eclipse.elk.spacing.edgeNode"]).toBe("20");
  });

  it("merges loop-back keys into force options", () => {
    const opts = getLayoutOptionsWithLoopBack("force");
    expect(opts["org.eclipse.elk.algorithm"]).toBe("org.eclipse.elk.force");
    expect(opts["org.eclipse.elk.edgeRouting"]).toBe("ORTHOGONAL");
    expect(opts["org.eclipse.elk.layered.cycleBreaking.strategy"]).toBe("GREEDY");
    expect(opts["org.eclipse.elk.layered.considerModelOrder.strategy"]).toBe("NODES_AND_EDGES");
  });

  it("merges loop-back keys into radial options", () => {
    const opts = getLayoutOptionsWithLoopBack("radial");
    expect(opts["org.eclipse.elk.algorithm"]).toBe("org.eclipse.elk.radial");
    expect(opts["org.eclipse.elk.edgeRouting"]).toBe("ORTHOGONAL");
    expect(opts["org.eclipse.elk.layered.cycleBreaking.strategy"]).toBe("GREEDY");
    expect(opts["org.eclipse.elk.layered.considerModelOrder.strategy"]).toBe("NODES_AND_EDGES");
  });

  it("does not mutate the base strategy options", () => {
    const before = { ...getLayoutOptions("layered") };
    getLayoutOptionsWithLoopBack("layered");
    const after = getLayoutOptions("layered");
    expect(after).toEqual(before);
  });

  describe("loop-back keys override any conflicting strategy value", () => {
    const strategies: LayoutStrategy[] = ["layered", "force", "radial"];

    for (const strategy of strategies) {
      it(`${strategy}: edgeRouting is ORTHOGONAL`, () => {
        const opts = getLayoutOptionsWithLoopBack(strategy);
        expect(opts["org.eclipse.elk.edgeRouting"]).toBe("ORTHOGONAL");
      });
    }
  });

  it("result contains both base strategy keys and all three loop-back keys", () => {
    const base = getLayoutOptions("layered");
    const merged = getLayoutOptionsWithLoopBack("layered");

    for (const key of Object.keys(base)) {
      expect(merged).toHaveProperty(key);
    }
    expect(merged).toHaveProperty("org.eclipse.elk.edgeRouting");
    expect(merged).toHaveProperty("org.eclipse.elk.layered.cycleBreaking.strategy");
    expect(merged).toHaveProperty("org.eclipse.elk.layered.considerModelOrder.strategy");
  });
});
