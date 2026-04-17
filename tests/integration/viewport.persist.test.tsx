import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { createStore } from "@/store/createStore";
import { useWorkflowStore } from "@/store/hooks";
import { useAutoSave } from "@/features/persistence/useAutoSave";
import type { ViewportState } from "@/store/slices/viewportSlice";

const mockSetViewport = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    setViewport: mockSetViewport,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  }),
}));

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

describe("Integration: useAutoSave hook end-to-end", () => {
  function resetStore() {
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.setPan(0, 0);
      result.current.setZoom(1);
    });
    unmount();
  }

  beforeEach(() => {
    resetStore();
    mockSetViewport.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("save() captures current viewport in payload", () => {
    // Set viewport via store
    const { result: storeResult, unmount: unmountStore } = renderHook(() => useWorkflowStore());
    act(() => {
      storeResult.current.setPan(250, -80);
      storeResult.current.setZoom(2);
    });
    unmountStore();

    // Call save via useAutoSave — read payload synchronously from result
    const { result } = renderHook(() => useAutoSave());
    const payload = result.current.save();

    expect(payload.viewport).toEqual({ x: 250, y: -80, zoom: 2 });
    expect(Array.isArray(payload.nodes)).toBe(true);
    expect(Array.isArray(payload.edges)).toBe(true);
  });

  it("restore() updates store AND calls setViewport on xyflow instance", () => {
    // Set viewport, save
    const { result: storeResult, unmount: unmountStore } = renderHook(() => useWorkflowStore());
    act(() => {
      storeResult.current.setPan(100, 200);
      storeResult.current.setZoom(1.5);
    });
    unmountStore();

    const { result: autoSave, unmount: unmountSave } = renderHook(() => useAutoSave());
    const savedPayload = autoSave.current.save();
    unmountSave();

    // Reset viewport to defaults
    const { result: resetResult, unmount: unmountReset } = renderHook(() => useWorkflowStore());
    act(() => {
      resetResult.current.setPan(0, 0);
      resetResult.current.setZoom(1);
    });
    unmountReset();

    // Restore from saved payload
    const { result: restoreHook, unmount: unmountRestore } = renderHook(() => useAutoSave());
    act(() => {
      restoreHook.current.restore(savedPayload);
    });
    unmountRestore();

    // Assert xyflow setViewport was called with saved viewport
    expect(mockSetViewport).toHaveBeenCalledWith({ x: 100, y: 200, zoom: 1.5 });

    // Assert store viewport matches
    const { result: verifyResult, unmount: unmountVerify } = renderHook(() => useWorkflowStore());
    expect(verifyResult.current.panX).toBe(100);
    expect(verifyResult.current.panY).toBe(200);
    expect(verifyResult.current.zoom).toBe(1.5);
    unmountVerify();
  });

  it("full round-trip: set → save → mutate → restore → store + xyflow match", () => {
    // Set a specific viewport
    const { result: s1, unmount: u1 } = renderHook(() => useWorkflowStore());
    act(() => {
      s1.current.setPan(-300, 450);
      s1.current.setZoom(0.75);
    });
    u1();

    // Save via hook
    const { result: a1, unmount: u2 } = renderHook(() => useAutoSave());
    const payload = a1.current.save();
    u2();

    expect(payload.viewport).toEqual({ x: -300, y: 450, zoom: 0.75 });

    // Mutate viewport to something different
    const { result: s2, unmount: u3 } = renderHook(() => useWorkflowStore());
    act(() => {
      s2.current.setPan(999, 999);
      s2.current.setZoom(4);
    });
    u3();

    // Restore
    const { result: a2, unmount: u4 } = renderHook(() => useAutoSave());
    act(() => {
      a2.current.restore(payload);
    });
    u4();

    // Verify xyflow setViewport called with original values
    expect(mockSetViewport).toHaveBeenCalledWith({ x: -300, y: 450, zoom: 0.75 });

    // Verify store state matches
    const { result: final, unmount: u5 } = renderHook(() => useWorkflowStore());
    expect(final.current.getViewportState()).toEqual({ x: -300, y: 450, zoom: 0.75 });
    u5();
  });
});
