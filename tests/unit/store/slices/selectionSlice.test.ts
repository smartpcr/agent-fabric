import { describe, it, expect, beforeEach } from "vitest";
import { createStore, type WorkflowState } from "@/store/createStore";
import type { StoreApi } from "zustand";

let store: StoreApi<WorkflowState>;

beforeEach(() => {
  store = createStore();
});

describe("selectionSlice", () => {
  describe("initial state", () => {
    it("starts with empty selected set", () => {
      expect(store.getState().selected.size).toBe(0);
    });

    it("starts with empty selectedNodeIds", () => {
      expect(store.getState().selectedNodeIds).toEqual([]);
    });
  });

  describe("select(id, mode)", () => {
    it("replace mode sets a single node as selected", () => {
      store.getState().select("node-1", "replace");
      expect(store.getState().selected.has("node-1")).toBe(true);
      expect(store.getState().selected.size).toBe(1);
    });

    it("replace mode clears previous selection", () => {
      store.getState().select("node-1", "replace");
      store.getState().select("node-2", "replace");
      expect(store.getState().selected.has("node-1")).toBe(false);
      expect(store.getState().selected.has("node-2")).toBe(true);
      expect(store.getState().selected.size).toBe(1);
    });

    it("add mode adds to existing selection", () => {
      store.getState().select("node-1", "replace");
      store.getState().select("node-2", "add");
      expect(store.getState().selected.has("node-1")).toBe(true);
      expect(store.getState().selected.has("node-2")).toBe(true);
      expect(store.getState().selected.size).toBe(2);
    });

    it("add mode does not duplicate an already selected id", () => {
      store.getState().select("node-1", "replace");
      store.getState().select("node-1", "add");
      expect(store.getState().selected.size).toBe(1);
    });

    it("toggle mode adds an unselected node", () => {
      store.getState().select("node-1", "toggle");
      expect(store.getState().selected.has("node-1")).toBe(true);
    });

    it("toggle mode removes an already selected node", () => {
      store.getState().select("node-1", "replace");
      store.getState().select("node-1", "toggle");
      expect(store.getState().selected.has("node-1")).toBe(false);
      expect(store.getState().selected.size).toBe(0);
    });

    it("toggle mode preserves other selected nodes", () => {
      store.getState().select("node-1", "replace");
      store.getState().select("node-2", "add");
      store.getState().select("node-1", "toggle");
      expect(store.getState().selected.has("node-1")).toBe(false);
      expect(store.getState().selected.has("node-2")).toBe(true);
      expect(store.getState().selected.size).toBe(1);
    });

    it("syncs selectedNodeIds with selected set", () => {
      store.getState().select("node-1", "replace");
      store.getState().select("node-2", "add");
      const ids = store.getState().selectedNodeIds;
      expect(ids).toContain("node-1");
      expect(ids).toContain("node-2");
      expect(ids).toHaveLength(2);
    });
  });

  describe("selectMany(ids)", () => {
    it("selects multiple nodes at once", () => {
      store.getState().selectMany(["a", "b", "c"]);
      expect(store.getState().selected.size).toBe(3);
      expect(store.getState().selected.has("a")).toBe(true);
      expect(store.getState().selected.has("b")).toBe(true);
      expect(store.getState().selected.has("c")).toBe(true);
    });

    it("replaces previous selection", () => {
      store.getState().select("x", "replace");
      store.getState().selectMany(["a", "b"]);
      expect(store.getState().selected.has("x")).toBe(false);
      expect(store.getState().selected.size).toBe(2);
    });

    it("de-duplicates ids", () => {
      store.getState().selectMany(["a", "b", "a", "c", "b"]);
      expect(store.getState().selected.size).toBe(3);
    });

    it("syncs selectedNodeIds", () => {
      store.getState().selectMany(["a", "b"]);
      expect(store.getState().selectedNodeIds).toContain("a");
      expect(store.getState().selectedNodeIds).toContain("b");
    });
  });

  describe("clear()", () => {
    it("clears the selected set", () => {
      store.getState().select("node-1", "replace");
      store.getState().select("node-2", "add");
      store.getState().clear();
      expect(store.getState().selected.size).toBe(0);
    });

    it("clears selectedNodeIds", () => {
      store.getState().select("node-1", "replace");
      store.getState().clear();
      expect(store.getState().selectedNodeIds).toEqual([]);
    });
  });

  describe("isSelected(id)", () => {
    it("returns true for a selected node", () => {
      store.getState().select("node-1", "replace");
      expect(store.getState().isSelected("node-1")).toBe(true);
    });

    it("returns false for an unselected node", () => {
      store.getState().select("node-1", "replace");
      expect(store.getState().isSelected("node-2")).toBe(false);
    });

    it("returns false after clear", () => {
      store.getState().select("node-1", "replace");
      store.getState().clear();
      expect(store.getState().isSelected("node-1")).toBe(false);
    });
  });

  describe("legacy API compatibility", () => {
    it("selectBulk() sets both selectedNodeIds and selectedEdgeIds", () => {
      store.getState().selectBulk(["n1"], ["e1"]);
      expect(store.getState().selectedNodeIds).toEqual(["n1"]);
      expect(store.getState().selectedEdgeIds).toEqual(["e1"]);
    });

    it("selectBulk() syncs selected set", () => {
      store.getState().selectBulk(["n1", "n2"], []);
      expect(store.getState().selected.has("n1")).toBe(true);
      expect(store.getState().selected.has("n2")).toBe(true);
    });

    it("clearSelection() clears everything", () => {
      store.getState().selectBulk(["n1"], ["e1"]);
      store.getState().clearSelection();
      expect(store.getState().selectedNodeIds).toEqual([]);
      expect(store.getState().selectedEdgeIds).toEqual([]);
      expect(store.getState().selected.size).toBe(0);
    });
  });
});
