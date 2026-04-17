import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { MultiPortTaskNodeSpec } from "@/registry/builtins/MultiPortTaskNode.spec";
import { useWorkflowStore } from "@/store/hooks";

// Track ReactFlow props — not captured for assertions, just for completeness

vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, unknown> & { children?: ReactNode }) => {
    return <div data-testid="mock-reactflow">{props.children}</div>;
  },
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="mock-controls">{children}</div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
  }),
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
  Handle: (props: { id?: string; type?: string; "aria-label"?: string }) => {
    const handleId = props.id ?? "";
    const handleType = props.type ?? "";
    return (
      <div
        data-testid={`handle-${handleId}`}
        className={`react-flow__handle ${handleType === "source" ? "source" : "target"}`}
        data-handleid={handleId}
        data-handletype={handleType}
        tabIndex={0}
        role="button"
        aria-label={props["aria-label"]}
      />
    );
  },
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

afterEach(() => {
  cleanup();
});

function setupStoreWithMultiPort() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  registry.register(MultiPortTaskNodeSpec);

  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
  });
  unmount();
}

function addMultiPortNodes(): { sourceId: string; targetId: string } {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  let sourceId = "";
  let targetId = "";
  act(() => {
    const source = result.current.addNode(MultiPortTaskNodeSpec, { x: 0, y: 0 });
    const target = result.current.addNode(MultiPortTaskNodeSpec, { x: 200, y: 200 });
    sourceId = source.id;
    targetId = target.id;
  });
  unmount();
  return { sourceId, targetId };
}

function getStoreEdges() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const edges = result.current.edges;
  unmount();
  return edges;
}

function renderCanvas() {
  return render(
    <ToastProvider>
      <DragProvider>
        <Canvas />
      </DragProvider>
    </ToastProvider>,
  );
}

describe("Keyboard connection flow", () => {
  beforeEach(() => {
    setupStoreWithMultiPort();
  });

  function createSourceHandle(canvas: HTMLElement, sourceId: string, portId = "outA"): HTMLElement {
    const handleEl = document.createElement("div");
    handleEl.className = "react-flow__handle";
    handleEl.dataset.handletype = "source";
    handleEl.dataset.handleid = portId;
    const nodeWrapper = document.createElement("div");
    nodeWrapper.setAttribute("data-id", sourceId);
    nodeWrapper.appendChild(handleEl);
    canvas.appendChild(nodeWrapper);
    return handleEl;
  }

  it("Enter on a source handle enters connect mode and announces targets", () => {
    const { sourceId } = addMultiPortNodes();
    renderCanvas();

    const canvas = screen.getByRole("application");
    const handleEl = createSourceHandle(canvas, sourceId);

    // Fire Enter on the handle itself — it bubbles to canvas
    act(() => {
      fireEvent.keyDown(handleEl, { key: "Enter", bubbles: true });
    });

    const announcement = screen.getByTestId("connect-announcement");
    expect(announcement.textContent).toContain("Connect mode");
    expect(announcement.textContent).toContain("targets");
  });

  it("Arrow keys cycle through compatible targets", () => {
    const { sourceId } = addMultiPortNodes();
    renderCanvas();

    const canvas = screen.getByRole("application");
    // outC is type "any" — compatible with both inA (string) and inB (json)
    const handleEl = createSourceHandle(canvas, sourceId, "outC");

    // Enter connect mode
    act(() => {
      fireEvent.keyDown(handleEl, { key: "Enter", bubbles: true });
    });

    const announcement = screen.getByTestId("connect-announcement");
    expect(announcement.textContent).toContain("1 of");

    // ArrowDown moves to next target
    act(() => {
      fireEvent.keyDown(canvas, { key: "ArrowDown" });
    });

    expect(announcement.textContent).toContain("2 of");

    // ArrowUp moves back
    act(() => {
      fireEvent.keyDown(canvas, { key: "ArrowUp" });
    });

    expect(announcement.textContent).toContain("1 of");
  });

  it("Enter confirms connection to the currently selected target", () => {
    const { sourceId } = addMultiPortNodes();
    renderCanvas();

    const canvas = screen.getByRole("application");
    const handleEl = createSourceHandle(canvas, sourceId);

    expect(getStoreEdges()).toHaveLength(0);

    // Enter connect mode
    act(() => {
      fireEvent.keyDown(handleEl, { key: "Enter", bubbles: true });
    });

    // Confirm connection
    act(() => {
      fireEvent.keyDown(canvas, { key: "Enter" });
    });

    const edges = getStoreEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0]?.source).toBe(sourceId);

    const announcement = screen.getByTestId("connect-announcement");
    expect(announcement.textContent).toContain("Connected to");
  });

  it("Escape cancels connect mode without creating an edge", () => {
    const { sourceId } = addMultiPortNodes();
    renderCanvas();

    const canvas = screen.getByRole("application");
    const handleEl = createSourceHandle(canvas, sourceId);

    // Enter connect mode
    act(() => {
      fireEvent.keyDown(handleEl, { key: "Enter", bubbles: true });
    });

    expect(screen.getByTestId("connect-announcement").textContent).toContain("Connect mode");

    // Cancel
    act(() => {
      fireEvent.keyDown(canvas, { key: "Escape" });
    });

    expect(getStoreEdges()).toHaveLength(0);
    expect(screen.getByTestId("connect-announcement").textContent).toContain("cancelled");
  });

  it("does not enter connect mode from a target handle", () => {
    const { sourceId } = addMultiPortNodes();
    renderCanvas();

    const canvas = screen.getByRole("application");
    const handleEl = document.createElement("div");
    handleEl.className = "react-flow__handle";
    handleEl.dataset.handletype = "target";
    handleEl.dataset.handleid = "inA";
    const nodeWrapper = document.createElement("div");
    nodeWrapper.setAttribute("data-id", sourceId);
    nodeWrapper.appendChild(handleEl);
    canvas.appendChild(nodeWrapper);

    act(() => {
      fireEvent.keyDown(handleEl, { key: "Enter", bubbles: true });
    });

    const announcement = screen.getByTestId("connect-announcement");
    expect(announcement.textContent).not.toContain("Connect mode");
  });

  it("screen-reader live region has assertive aria-live", () => {
    renderCanvas();
    const announcement = screen.getByTestId("connect-announcement");
    expect(announcement.getAttribute("aria-live")).toBe("assertive");
    expect(announcement.getAttribute("role")).toBe("status");
  });

  it("full keyboard path: Tab → Enter → ArrowDown → Enter creates connection", () => {
    const { sourceId } = addMultiPortNodes();
    renderCanvas();

    const canvas = screen.getByRole("application");
    const handleEl = createSourceHandle(canvas, sourceId);

    expect(getStoreEdges()).toHaveLength(0);

    // Enter connect mode
    act(() => {
      fireEvent.keyDown(handleEl, { key: "Enter", bubbles: true });
    });
    expect(screen.getByTestId("connect-announcement").textContent).toContain("Connect mode");

    // ArrowDown to move to next target
    act(() => {
      fireEvent.keyDown(canvas, { key: "ArrowDown" });
    });

    // Enter confirms the connection
    act(() => {
      fireEvent.keyDown(canvas, { key: "Enter" });
    });

    expect(getStoreEdges()).toHaveLength(1);
    expect(screen.getByTestId("connect-announcement").textContent).toContain("Connected to");
  });
});
