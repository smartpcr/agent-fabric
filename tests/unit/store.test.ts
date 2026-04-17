import { describe, it, expect } from "vitest";
import { createStore } from "@/store/createStore";

describe("createStore", () => {
  it("returns a store containing keys from all five slices", () => {
    const store = createStore();
    const state = store.getState();

    // graphSlice keys
    expect(state).toHaveProperty("nodes");
    expect(state).toHaveProperty("edges");
    expect(state).toHaveProperty("addNode");
    expect(state).toHaveProperty("removeNode");

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

    store1.getState().addNode({ id: "n1" });

    expect(store1.getState().nodes).toHaveLength(1);
    expect(store2.getState().nodes).toHaveLength(0);
  });
});
