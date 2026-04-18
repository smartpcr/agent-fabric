import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
  renderHook,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";
import { CURRENT_SCHEMA_VERSION } from "@/domain/models/graph";

// Radix Toast pointer capture polyfills for jsdom
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  // eslint-disable-next-line no-empty-function
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  // eslint-disable-next-line no-empty-function
  Element.prototype.releasePointerCapture = () => {};
}
/* eslint-enable @typescript-eslint/no-unnecessary-condition */

// ─── Mocks ───────────────────────────────────────────────────────────

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
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
  }),
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

vi.mock("@/features/canvas/Background", () => ({
  Background: () => <div data-testid="mock-background" />,
}));

// ─── Fixtures ────────────────────────────────────────────────────────

function validGraphJson(name = "Dropped Workflow"): string {
  return JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "g-drop",
    name,
    nodes: [{ id: "n1", kind: "task", position: { x: 10, y: 20 }, data: {} }],
    edges: [],
  });
}

function makeJsonFile(content: string, name = "workflow.json"): File {
  return new File([content], name, { type: "application/json" });
}

function makeDragEventInit(files: File[]): { dataTransfer: Partial<DataTransfer> } {
  return {
    dataTransfer: {
      files: files as unknown as FileList,
      items: files.map((f) => ({
        kind: "file" as const,
        type: f.type,
        getAsFile: () => f,
      })) as unknown as DataTransferItemList,
      dropEffect: "none",
      effectAllowed: "all",
      types: ["Files"],
    } as unknown as DataTransfer,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function renderCanvas() {
  return render(
    <ToastProvider>
      <DragProvider>
        <Canvas />
      </DragProvider>
    </ToastProvider>,
  );
}

function getCanvasDiv() {
  return screen.getByRole("application", { name: "Workflow Canvas" });
}

function setupStore() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    // Clear any existing nodes
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
  });
  unmount();
}

function getStoreNodes() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const nodes = result.current.nodes;
  unmount();
  return nodes;
}

// ─── Setup / Teardown ────────────────────────────────────────────────

beforeEach(() => {
  setupStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("canvas.file-drop", () => {
  it("shows drop overlay on dragenter with JSON file", () => {
    renderCanvas();
    const canvas = getCanvasDiv();

    const dt = makeDragEventInit([makeJsonFile(validGraphJson())]);

    act(() => {
      fireEvent.dragEnter(canvas, dt);
    });

    expect(screen.getByTestId("file-drop-overlay")).toBeInTheDocument();
    expect(screen.getByText("Drop workflow JSON to import")).toBeInTheDocument();
  });

  it("hides drop overlay on dragleave", () => {
    renderCanvas();
    const canvas = getCanvasDiv();

    const dt = makeDragEventInit([makeJsonFile(validGraphJson())]);

    act(() => {
      fireEvent.dragEnter(canvas, dt);
    });

    expect(screen.getByTestId("file-drop-overlay")).toBeInTheDocument();

    act(() => {
      fireEvent.dragLeave(canvas);
    });

    expect(screen.queryByTestId("file-drop-overlay")).not.toBeInTheDocument();
  });

  it("prevents default on dragover for JSON files", () => {
    renderCanvas();
    const canvas = getCanvasDiv();

    const init = makeDragEventInit([makeJsonFile(validGraphJson())]);

    const event = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: init.dataTransfer });

    act(() => {
      canvas.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it("imports valid JSON on drop after user confirms", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderCanvas();
    const canvas = getCanvasDiv();

    const dt = makeDragEventInit([makeJsonFile(validGraphJson("My Dropped WF"))]);

    act(() => {
      fireEvent.drop(canvas, dt);
    });

    // Wait for FileReader to complete
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        'Import "My Dropped WF"? This will replace the current workflow.',
      );
    });

    // Store should now have the imported node
    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("n1");
    expect(nodes[0].kind).toBe("task");
  });

  it("does not import when user cancels confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderCanvas();
    const canvas = getCanvasDiv();

    const dt = makeDragEventInit([makeJsonFile(validGraphJson())]);

    act(() => {
      fireEvent.drop(canvas, dt);
    });

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });

    // Store should still have no nodes
    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(0);
  });

  it("shows error toast for invalid JSON on drop", async () => {
    renderCanvas();
    const canvas = getCanvasDiv();

    const dt = makeDragEventInit([makeJsonFile("not json")]);

    act(() => {
      fireEvent.drop(canvas, dt);
    });

    await waitFor(() => {
      expect(screen.getByText("Import failed")).toBeInTheDocument();
    });
    expect(screen.getByText("File is not valid JSON.")).toBeInTheDocument();
  });

  it("shows error toast for valid JSON that fails schema validation on drop", async () => {
    renderCanvas();
    const canvas = getCanvasDiv();

    const dt = makeDragEventInit([makeJsonFile(JSON.stringify({ foo: "bar" }))]);

    act(() => {
      fireEvent.drop(canvas, dt);
    });

    await waitFor(() => {
      expect(screen.getByText("Import failed")).toBeInTheDocument();
    });
  });

  it("removes overlay after drop", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderCanvas();
    const canvas = getCanvasDiv();

    const dt = makeDragEventInit([makeJsonFile(validGraphJson())]);

    // First show overlay via dragenter
    act(() => {
      fireEvent.dragEnter(canvas, dt);
    });
    expect(screen.getByTestId("file-drop-overlay")).toBeInTheDocument();

    // Drop removes overlay
    act(() => {
      fireEvent.drop(canvas, dt);
    });
    expect(screen.queryByTestId("file-drop-overlay")).not.toBeInTheDocument();
  });

  it("does nothing when dropping a non-file drag", () => {
    renderCanvas();
    const canvas = getCanvasDiv();

    // Empty DataTransfer (no files)
    const emptyDt = {
      dataTransfer: {
        files: [] as unknown as FileList,
        items: [] as unknown as DataTransferItemList,
        dropEffect: "none",
        effectAllowed: "all",
        types: [],
      },
    };

    act(() => {
      fireEvent.drop(canvas, emptyDt);
    });

    // No error toast, no store changes
    expect(screen.queryByText("Import failed")).not.toBeInTheDocument();
    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(0);
  });
});
