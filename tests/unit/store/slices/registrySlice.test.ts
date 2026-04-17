import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { makeOutputPort, makeInputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { selectNodeSpec, clearSelectorCache } from "@/store/selectors/graphSelectors";

const startSpec: NodeSpec = {
  kind: "start",
  category: "flow",
  label: "Start",
  icon: "play",
  ports: [makeOutputPort({ id: "out", label: "Out", dataType: "any" })],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: ["isEntry"],
};

const endSpec: NodeSpec = {
  kind: "end",
  category: "flow",
  label: "End",
  icon: "stop",
  ports: [makeInputPort({ id: "in", label: "In", dataType: "any" })],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: ["isTerminal"],
};

describe("registrySlice", () => {
  describe("registry field", () => {
    it("initializes with an empty NodeRegistry", () => {
      const store = createStore();
      expect(store.getState().registry).toBeInstanceOf(NodeRegistry);
      expect(store.getState().registry.list()).toHaveLength(0);
    });
  });

  describe("setRegistry", () => {
    it("replaces the registry instance", () => {
      const store = createStore();
      const reg = new NodeRegistry();
      reg.register(startSpec);

      store.getState().setRegistry(reg);

      expect(store.getState().registry).toBe(reg);
      expect(store.getState().registry.list()).toHaveLength(1);
    });

    it("new registry is queryable after set", () => {
      const store = createStore();
      const reg = new NodeRegistry();
      reg.register(startSpec);
      reg.register(endSpec);

      store.getState().setRegistry(reg);

      expect(store.getState().registry.resolve("start")).toBe(startSpec);
      expect(store.getState().registry.resolve("end")).toBe(endSpec);
    });
  });

  describe("selectNodeSpec", () => {
    beforeEach(() => {
      clearSelectorCache();
    });

    it("resolves a registered spec by kind", () => {
      const store = createStore();
      const reg = new NodeRegistry();
      reg.register(startSpec);
      store.getState().setRegistry(reg);

      const result = selectNodeSpec(store.getState(), "start");
      expect(result).toBe(startSpec);
    });

    it("returns undefined for unregistered kind", () => {
      const store = createStore();
      const result = selectNodeSpec(store.getState(), "nonexistent");
      expect(result).toBeUndefined();
    });

    it("returns referentially stable result across unrelated state changes", () => {
      const store = createStore();
      const reg = new NodeRegistry();
      reg.register(startSpec);
      store.getState().setRegistry(reg);

      const first = selectNodeSpec(store.getState(), "start");

      // Trigger unrelated state change
      store.getState().addNode(startSpec, { x: 100, y: 200 });

      const second = selectNodeSpec(store.getState(), "start");

      expect(first).toBe(second);
    });

    it("returns same undefined for repeated calls on unknown kind", () => {
      const store = createStore();
      const r1 = selectNodeSpec(store.getState(), "missing");
      const r2 = selectNodeSpec(store.getState(), "missing");
      expect(r1).toBeUndefined();
      expect(r2).toBeUndefined();
    });

    it("returns new reference when registry is replaced with different spec", () => {
      const store = createStore();
      const reg1 = new NodeRegistry();
      reg1.register(startSpec);
      store.getState().setRegistry(reg1);

      const first = selectNodeSpec(store.getState(), "start");

      const modifiedStart: NodeSpec = {
        ...startSpec,
        label: "Modified Start",
      };
      const reg2 = new NodeRegistry();
      reg2.register(modifiedStart);
      store.getState().setRegistry(reg2);

      const second = selectNodeSpec(store.getState(), "start");

      expect(second).not.toBe(first);
      expect(second?.label).toBe("Modified Start");
    });

    it("maintains separate memoization per kind", () => {
      const store = createStore();
      const reg = new NodeRegistry();
      reg.register(startSpec);
      reg.register(endSpec);
      store.getState().setRegistry(reg);

      const startResult = selectNodeSpec(store.getState(), "start");
      const endResult = selectNodeSpec(store.getState(), "end");

      expect(startResult).toBe(startSpec);
      expect(endResult).toBe(endSpec);
      expect(startResult).not.toBe(endResult);
    });
  });

  describe("existing registerNodeSpec/registerNodeType", () => {
    it("registerNodeSpec still works", () => {
      const store = createStore();
      store.getState().registerNodeSpec(startSpec);
      expect(store.getState().nodeSpecs.start).toBe(startSpec);
    });

    it("registerNodeType still works", () => {
      const store = createStore();
      const def = { component: "StartNode" };
      store.getState().registerNodeType("start", def);
      expect(store.getState().nodeTypes.start).toBe(def);
    });
  });
});
