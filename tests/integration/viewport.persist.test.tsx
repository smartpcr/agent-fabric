import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "@/store/createStore";
import type { ViewportState } from "@/store/slices/viewportSlice";

describe("Integration: viewport persistence (set → save → restore → match)", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("getViewportState returns the default viewport {x:0, y:0, zoom:1}", () => {
    const vp = store.getState().getViewportState();
    expect(vp).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("set viewport → getViewportState reflects changes", () => {
    store.getState().setPan(120, -50);
    store.getState().setZoom(2.5);

    const vp = store.getState().getViewportState();
    expect(vp).toEqual({ x: 120, y: -50, zoom: 2.5 });
  });

  it("round-trip: set viewport → save → reset → restore → viewport matches", () => {
    // 1. Set viewport
    store.getState().setPan(300, 150);
    store.getState().setZoom(1.75);

    // 2. Save (snapshot the viewport state)
    const saved: ViewportState = store.getState().getViewportState();
    expect(saved).toEqual({ x: 300, y: 150, zoom: 1.75 });

    // 3. Reset to different values (simulates loading a different workflow)
    store.getState().setPan(0, 0);
    store.getState().setZoom(1);
    expect(store.getState().getViewportState()).toEqual({ x: 0, y: 0, zoom: 1 });

    // 4. Restore from saved payload
    store.getState().restoreViewport(saved);

    // 5. Viewport matches the original
    const restored = store.getState().getViewportState();
    expect(restored).toEqual({ x: 300, y: 150, zoom: 1.75 });
    expect(restored.x).toBe(saved.x);
    expect(restored.y).toBe(saved.y);
    expect(restored.zoom).toBe(saved.zoom);
  });

  it("viewport is included in a save payload alongside graph data", () => {
    store.getState().setPan(-42, 99);
    store.getState().setZoom(0.5);

    // Simulate building a save payload (as useAutoSave.save would)
    const state = store.getState();
    const payload = {
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.getViewportState(),
    };

    expect(payload.viewport).toEqual({ x: -42, y: 99, zoom: 0.5 });
    expect(payload.nodes).toEqual([]);
    expect(payload.edges).toEqual([]);
  });

  it("restoreViewport updates panX, panY, and zoom in store state", () => {
    const viewport: ViewportState = { x: -100, y: 200, zoom: 3 };
    store.getState().restoreViewport(viewport);

    const state = store.getState();
    expect(state.panX).toBe(-100);
    expect(state.panY).toBe(200);
    expect(state.zoom).toBe(3);
  });

  it("viewport persistence survives multiple save/restore cycles", () => {
    const viewports: ViewportState[] = [
      { x: 10, y: 20, zoom: 0.5 },
      { x: -500, y: 300, zoom: 4 },
      { x: 0, y: 0, zoom: 1 },
    ];

    for (const vp of viewports) {
      // Save a viewport
      store.getState().restoreViewport(vp);
      const saved = store.getState().getViewportState();
      expect(saved).toEqual(vp);

      // Reset
      store.getState().restoreViewport({ x: 999, y: 999, zoom: 0.1 });

      // Restore and verify
      store.getState().restoreViewport(saved);
      expect(store.getState().getViewportState()).toEqual(vp);
    }
  });
});
