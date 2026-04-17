import { describe, it, expect, beforeEach } from "vitest";
import { createStore, type WorkflowState } from "@/store/createStore";
import type { StoreApi } from "zustand";

let store: StoreApi<WorkflowState>;

beforeEach(() => {
  store = createStore();
});

describe("selectionSlice — edge selection", () => {
  describe("initial state", () => {
    it("starts with empty selectedEdges set", () => {
      expect(store.getState().selectedEdges.size).toBe(0);
    });

    it("starts with empty selectedEdgeIds array", () => {
      expect(store.getState().selectedEdgeIds).toEqual([]);
    });
  });

  describe("selectEdge(id, mode)", () => {
    it("replace mode selects a single edge", () => {
      store.getState().selectEdge("edge-1", "replace");
      expect(store.getState().selectedEdges.has("edge-1")).toBe(true);
      expect(store.getState().selectedEdges.size).toBe(1);
    });

    it("replace mode clears previous edge selection", () => {
      store.getState().selectEdge("edge-1", "replace");
      store.getState().selectEdge("edge-2", "replace");
      expect(store.getState().selectedEdges.has("edge-1")).toBe(false);
      expect(store.getState().selectedEdges.has("edge-2")).toBe(true);
      expect(store.getState().selectedEdges.size).toBe(1);
    });

    it("add mode adds to existing edge selection (shift-click)", () => {
      store.getState().selectEdge("edge-1", "replace");
      store.getState().selectEdge("edge-2", "add");
      expect(store.getState().selectedEdges.has("edge-1")).toBe(true);
      expect(store.getState().selectedEdges.has("edge-2")).toBe(true);
      expect(store.getState().selectedEdges.size).toBe(2);
    });

    it("add mode does not duplicate an already selected edge", () => {
      store.getState().selectEdge("edge-1", "replace");
      store.getState().selectEdge("edge-1", "add");
      expect(store.getState().selectedEdges.size).toBe(1);
    });

    it("toggle mode adds an unselected edge", () => {
      store.getState().selectEdge("edge-1", "toggle");
      expect(store.getState().selectedEdges.has("edge-1")).toBe(true);
    });

    it("toggle mode removes an already selected edge", () => {
      store.getState().selectEdge("edge-1", "replace");
      store.getState().selectEdge("edge-1", "toggle");
      expect(store.getState().selectedEdges.has("edge-1")).toBe(false);
      expect(store.getState().selectedEdges.size).toBe(0);
    });

    it("toggle mode preserves other selected edges", () => {
      store.getState().selectEdge("edge-1", "replace");
      store.getState().selectEdge("edge-2", "add");
      store.getState().selectEdge("edge-1", "toggle");
      expect(store.getState().selectedEdges.has("edge-1")).toBe(false);
      expect(store.getState().selectedEdges.has("edge-2")).toBe(true);
      expect(store.getState().selectedEdges.size).toBe(1);
    });

    it("syncs selectedEdgeIds array with selectedEdges set", () => {
      store.getState().selectEdge("edge-1", "replace");
      store.getState().selectEdge("edge-2", "add");
      const ids = store.getState().selectedEdgeIds;
      expect(ids).toContain("edge-1");
      expect(ids).toContain("edge-2");
      expect(ids).toHaveLength(2);
    });

    it("does not affect node selection", () => {
      store.getState().select("node-1", "replace");
      store.getState().selectEdge("edge-1", "replace");
      expect(store.getState().selected.has("node-1")).toBe(true);
      expect(store.getState().selectedEdges.has("edge-1")).toBe(true);
    });
  });

  describe("clearEdges()", () => {
    it("clears the selectedEdges set", () => {
      store.getState().selectEdge("edge-1", "replace");
      store.getState().selectEdge("edge-2", "add");
      store.getState().clearEdges();
      expect(store.getState().selectedEdges.size).toBe(0);
    });

    it("clears selectedEdgeIds array", () => {
      store.getState().selectEdge("edge-1", "replace");
      store.getState().clearEdges();
      expect(store.getState().selectedEdgeIds).toEqual([]);
    });

    it("does not affect node selection", () => {
      store.getState().select("node-1", "replace");
      store.getState().selectEdge("edge-1", "replace");
      store.getState().clearEdges();
      expect(store.getState().selected.has("node-1")).toBe(true);
      expect(store.getState().selectedEdges.size).toBe(0);
    });
  });

  describe("isEdgeSelected(id)", () => {
    it("returns true for a selected edge", () => {
      store.getState().selectEdge("edge-1", "replace");
      expect(store.getState().isEdgeSelected("edge-1")).toBe(true);
    });

    it("returns false for an unselected edge", () => {
      store.getState().selectEdge("edge-1", "replace");
      expect(store.getState().isEdgeSelected("edge-2")).toBe(false);
    });

    it("returns false after clearEdges", () => {
      store.getState().selectEdge("edge-1", "replace");
      store.getState().clearEdges();
      expect(store.getState().isEdgeSelected("edge-1")).toBe(false);
    });
  });

  describe("clearSelection() clears both nodes and edges", () => {
    it("clears both node and edge selections", () => {
      store.getState().select("node-1", "replace");
      store.getState().selectEdge("edge-1", "replace");
      store.getState().clearSelection();
      expect(store.getState().selected.size).toBe(0);
      expect(store.getState().selectedEdges.size).toBe(0);
      expect(store.getState().selectedNodeIds).toEqual([]);
      expect(store.getState().selectedEdgeIds).toEqual([]);
    });
  });

  describe("selectBulk() with edge IDs", () => {
    it("populates selectedEdges set from edge IDs", () => {
      store.getState().selectBulk(["n1"], ["e1", "e2"]);
      expect(store.getState().selectedEdges.has("e1")).toBe(true);
      expect(store.getState().selectedEdges.has("e2")).toBe(true);
      expect(store.getState().selectedEdges.size).toBe(2);
    });
  });

  describe("pane click clears edge selection (canvas behavior)", () => {
    it("clear() + clearEdges() together simulate pane click behavior", () => {
      store.getState().select("node-1", "replace");
      store.getState().selectEdge("edge-1", "replace");
      // Simulate what Canvas.handlePaneClick does
      store.getState().clear();
      store.getState().clearEdges();
      expect(store.getState().selected.size).toBe(0);
      expect(store.getState().selectedEdges.size).toBe(0);
    });
  });
});
