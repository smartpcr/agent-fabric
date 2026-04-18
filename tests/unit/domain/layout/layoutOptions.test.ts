import { describe, it, expect } from "vitest";
import {
  getLayoutOptions,
  DEFAULT_STRATEGY,
  type LayoutStrategy,
} from "@/domain/layout/layoutOptions";

describe("getLayoutOptions", () => {
  describe("default strategy", () => {
    it("DEFAULT_STRATEGY is 'layered'", () => {
      expect(DEFAULT_STRATEGY).toBe("layered");
    });

    it("returns layered options when called without arguments", () => {
      const opts = getLayoutOptions();
      expect(opts["org.eclipse.elk.algorithm"]).toBe("org.eclipse.elk.layered");
    });
  });

  describe("layered strategy", () => {
    it("sets algorithm to org.eclipse.elk.layered", () => {
      const opts = getLayoutOptions("layered");
      expect(opts["org.eclipse.elk.algorithm"]).toBe("org.eclipse.elk.layered");
    });

    it("sets direction to RIGHT", () => {
      const opts = getLayoutOptions("layered");
      expect(opts["org.eclipse.elk.direction"]).toBe("RIGHT");
    });

    it("sets between-layers spacing", () => {
      const opts = getLayoutOptions("layered");
      expect(opts["org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers"]).toBe("60");
    });

    it("includes common spacing options", () => {
      const opts = getLayoutOptions("layered");
      expect(opts["org.eclipse.elk.spacing.nodeNode"]).toBe("40");
      expect(opts["org.eclipse.elk.spacing.edgeNode"]).toBe("20");
    });
  });

  describe("force strategy", () => {
    it("sets algorithm to org.eclipse.elk.force", () => {
      const opts = getLayoutOptions("force");
      expect(opts["org.eclipse.elk.algorithm"]).toBe("org.eclipse.elk.force");
    });

    it("includes common spacing options", () => {
      const opts = getLayoutOptions("force");
      expect(opts["org.eclipse.elk.spacing.nodeNode"]).toBe("40");
      expect(opts["org.eclipse.elk.spacing.edgeNode"]).toBe("20");
    });

    it("does not include layered-specific keys", () => {
      const opts = getLayoutOptions("force");
      expect(opts["org.eclipse.elk.direction"]).toBeUndefined();
      expect(opts["org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers"]).toBeUndefined();
    });
  });

  describe("radial strategy", () => {
    it("sets algorithm to org.eclipse.elk.radial", () => {
      const opts = getLayoutOptions("radial");
      expect(opts["org.eclipse.elk.algorithm"]).toBe("org.eclipse.elk.radial");
    });

    it("includes common spacing options", () => {
      const opts = getLayoutOptions("radial");
      expect(opts["org.eclipse.elk.spacing.nodeNode"]).toBe("40");
      expect(opts["org.eclipse.elk.spacing.edgeNode"]).toBe("20");
    });

    it("does not include layered-specific keys", () => {
      const opts = getLayoutOptions("radial");
      expect(opts["org.eclipse.elk.direction"]).toBeUndefined();
      expect(opts["org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers"]).toBeUndefined();
    });
  });

  describe("each strategy has distinct algorithm", () => {
    it("all three strategies produce different algorithm values", () => {
      const strategies: LayoutStrategy[] = ["layered", "force", "radial"];
      const algos = strategies.map((s) => getLayoutOptions(s)["org.eclipse.elk.algorithm"]);

      expect(new Set(algos).size).toBe(3);
    });
  });
});
