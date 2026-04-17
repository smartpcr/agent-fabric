import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { makeOutputPort } from "@/domain/models/port";

const dummySpec: NodeSpec = {
  kind: "test",
  category: "test",
  label: "Test",
  icon: "box",
  ports: [makeOutputPort({ id: "out", label: "Out", dataType: "any" })],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: [],
};

describe("createStore", () => {
  it("returns a store containing keys from all five slices", () => {
    const store = createStore();
    const state = store.getState();

    // graphSlice keys
    expect(state).toHaveProperty("nodes");
    expect(state).toHaveProperty("edges");
    expect(state).toHaveProperty("addNode");
    expect(state).toHaveProperty("removeNode");
    expect(state).toHaveProperty("connectPorts");
    expect(state).toHaveProperty("updateNodeData");

    // selectionSlice keys
    expect(state).toHaveProperty("selectedNodeIds");
    expect(state).toHaveProperty("selectedEdgeIds");
    expect(state).toHaveProperty("select");
    expect(state).toHaveProperty("clearSelection");

    // registrySlice keys
    expect(state).toHaveProperty("nodeTypes");
    expect(state).toHaveProperty("registerNodeType");

    // executionSlice keys
    expect(state).toHaveProperty("executionStatus");
    expect(state).toHaveProperty("executionLog");
    expect(state).toHaveProperty("startExecution");
    expect(state).toHaveProperty("stopExecution");

    // viewportSlice keys
    expect(state).toHaveProperty("zoom");
    expect(state).toHaveProperty("panX");
    expect(state).toHaveProperty("panY");
    expect(state).toHaveProperty("setZoom");
    expect(state).toHaveProperty("setPan");
  });

  it("initial state matches inline snapshot", () => {
    const store = createStore();
    const state = store.getState();

    // Extract only data properties (no functions) for snapshot
    const dataState = {
      nodes: state.nodes,
      edges: state.edges,
      selectedNodeIds: state.selectedNodeIds,
      selectedEdgeIds: state.selectedEdgeIds,
      nodeTypes: state.nodeTypes,
      executionStatus: state.executionStatus,
      executionLog: state.executionLog,
      zoom: state.zoom,
      panX: state.panX,
      panY: state.panY,
    };

    expect(dataState).toMatchInlineSnapshot(`
      {
        "edges": [],
        "executionLog": [],
        "executionStatus": "idle",
        "nodeTypes": {},
        "nodes": [],
        "panX": 0,
        "panY": 0,
        "selectedEdgeIds": [],
        "selectedNodeIds": [],
        "zoom": 1,
      }
    `);
  });

  it("survives JSON round-trip when executionSlice is excluded", () => {
    const store = createStore();
    const state = store.getState();

    // Exclude executionSlice keys and action functions for serialization
    const serializableState = {
      nodes: state.nodes,
      edges: state.edges,
      selectedNodeIds: state.selectedNodeIds,
      selectedEdgeIds: state.selectedEdgeIds,
      nodeTypes: state.nodeTypes,
      zoom: state.zoom,
      panX: state.panX,
      panY: state.panY,
    };

    const roundTripped = JSON.parse(JSON.stringify(serializableState)) as typeof serializableState;

    expect(roundTripped).toEqual(serializableState);
  });

  it("each store instance is independent", () => {
    const store1 = createStore();
    const store2 = createStore();

    store1.getState().addNode(dummySpec);

    expect(store1.getState().nodes).toHaveLength(1);
    expect(store2.getState().nodes).toHaveLength(0);
  });
});

describe("graphSlice actions", () => {
  it("removeNode removes by id", () => {
    const store = createStore();
    const nodeA = store.getState().addNode(dummySpec);
    store.getState().addNode(dummySpec);
    store.getState().removeNode(nodeA.id);
    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0].id).not.toBe(nodeA.id);
  });
});

describe("selectionSlice actions", () => {
  it("select sets node and edge ids", () => {
    const store = createStore();
    store.getState().select(["n1"], ["e1"]);
    expect(store.getState().selectedNodeIds).toEqual(["n1"]);
    expect(store.getState().selectedEdgeIds).toEqual(["e1"]);
  });

  it("clearSelection resets selections", () => {
    const store = createStore();
    store.getState().select(["n1"], ["e1"]);
    store.getState().clearSelection();
    expect(store.getState().selectedNodeIds).toEqual([]);
    expect(store.getState().selectedEdgeIds).toEqual([]);
  });
});

describe("registrySlice actions", () => {
  it("registerNodeType adds to registry", () => {
    const store = createStore();
    store.getState().registerNodeType("custom", { label: "Custom" });
    expect(store.getState().nodeTypes).toEqual({ custom: { label: "Custom" } });
  });
});

describe("executionSlice actions", () => {
  it("startExecution sets status to running", () => {
    const store = createStore();
    store.getState().startExecution();
    expect(store.getState().executionStatus).toBe("running");
  });

  it("stopExecution resets status and log", () => {
    const store = createStore();
    store.getState().startExecution();
    store.getState().stopExecution();
    expect(store.getState().executionStatus).toBe("idle");
    expect(store.getState().executionLog).toEqual([]);
  });
});

describe("viewportSlice actions", () => {
  it("setZoom updates zoom", () => {
    const store = createStore();
    store.getState().setZoom(2);
    expect(store.getState().zoom).toBe(2);
  });

  it("setPan updates panX and panY", () => {
    const store = createStore();
    store.getState().setPan(100, 200);
    expect(store.getState().panX).toBe(100);
    expect(store.getState().panY).toBe(200);
  });
});
