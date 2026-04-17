import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, renderHook, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-reactflow">{children}</div>
  ),
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-controls">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
  Handle: (props: Record<string, unknown>) => (
    <div
      data-testid={props["data-testid"] as string}
      data-handle-type={props.type as string}
      data-handle-position={props.position as string}
    />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

vi.mock("@/store/selectors/graphSelectors", () => ({
  selectNodeSpec: () => ({ icon: "cog" }),
}));

afterEach(() => {
  cleanup();
});

function setupStore() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
    result.current.clear();
  });
  unmount();
}

function addNodes(...kinds: string[]) {
  const ids: string[] = [];
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    for (const kind of kinds) {
      const spec = result.current.registry.resolve(kind);
      const node = result.current.addNode(spec, { x: kinds.indexOf(kind) * 100, y: 0 });
      ids.push(node.id);
    }
  });
  unmount();
  return ids;
}

function selectNodes(...ids: string[]) {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.selectMany(ids);
  });
  unmount();
}

function getSelected(): Set<string> {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const selected = result.current.selected;
  unmount();
  return selected;
}

describe("Escape clears selection (scoped to canvas)", () => {
  it("Escape key on canvas clears selection", () => {
    setupStore();
    const [id1, id2] = addNodes("start", "task");
    selectNodes(id1, id2);
    expect(getSelected().size).toBe(2);

    render(
      <ToastProvider>
        <DragProvider>
          <Canvas />
        </DragProvider>
      </ToastProvider>,
    );

    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "Escape" });

    expect(getSelected().size).toBe(0);
  });

  it("Escape on canvas with no selection is a no-op", () => {
    setupStore();
    addNodes("start", "task");

    render(
      <ToastProvider>
        <DragProvider>
          <Canvas />
        </DragProvider>
      </ToastProvider>,
    );

    const canvas = screen.getByRole("application");
    fireEvent.keyDown(canvas, { key: "Escape" });

    expect(getSelected().size).toBe(0);
  });

  it("Escape outside canvas (property grid) does NOT clear selection", () => {
    setupStore();
    const [id1] = addNodes("start");
    selectNodes(id1);
    expect(getSelected().size).toBe(1);

    render(
      <div>
        <ToastProvider>
          <DragProvider>
            <Canvas />
          </DragProvider>
        </ToastProvider>
        <div data-testid="property-grid">
          <input data-testid="property-input" type="text" />
        </div>
      </div>,
    );

    // Fire Escape on the property input — outside the canvas element
    const propertyInput = screen.getByTestId("property-input");
    fireEvent.keyDown(propertyInput, { key: "Escape" });

    // Selection should remain intact since the listener is scoped to the canvas
    expect(getSelected().size).toBe(1);
    expect(getSelected().has(id1)).toBe(true);
  });

  it("Escape scoped to canvas element, not global document", () => {
    setupStore();
    const [id1, id2] = addNodes("start", "task");
    selectNodes(id1, id2);
    expect(getSelected().size).toBe(2);

    render(
      <div>
        <ToastProvider>
          <DragProvider>
            <Canvas />
          </DragProvider>
        </ToastProvider>
        <button data-testid="outside-panel" type="button">
          Outside
        </button>
      </div>,
    );

    // Fire Escape on the document body — should not reach canvas handler
    fireEvent.keyDown(document.body, { key: "Escape" });

    // Selection should remain since Escape was not on/within the canvas
    expect(getSelected().size).toBe(2);
  });

  it("Escape within a child of canvas does clear selection (bubbles up)", () => {
    setupStore();
    const [id1] = addNodes("start");
    selectNodes(id1);
    expect(getSelected().size).toBe(1);

    render(
      <ToastProvider>
        <DragProvider>
          <Canvas />
        </DragProvider>
      </ToastProvider>,
    );

    // Fire Escape on a child element inside the canvas (e.g., the ReactFlow mock)
    const reactFlowMock = screen.getByTestId("mock-reactflow");
    fireEvent.keyDown(reactFlowMock, { key: "Escape" });

    // Should clear because the event bubbles to the canvas div
    expect(getSelected().size).toBe(0);
  });
});
