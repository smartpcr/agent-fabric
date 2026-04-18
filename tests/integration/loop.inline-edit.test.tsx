import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { LoopNode } from "@/features/nodes/LoopNode";
import type { NodeProps } from "@xyflow/react";

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  Handle: (props: Record<string, unknown>) => (
    <div
      data-testid={props["data-testid"] as string}
      data-handle-type={props.type as string}
      data-handle-position={props.position as string}
      data-handle-id={props.id as string}
      data-port-id={props["data-port-id"] as string}
    />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
}));

const mockUpdateNodeData = vi.fn(() => ({ ok: true, value: undefined }));
const mockOpenInspector = vi.fn();
const mockSelect = vi.fn();
const mockDeleteSelected = vi.fn();

const loopWhilePorts = [
  { id: "in", kind: "in", label: "In", dataType: "any", cardinality: "single" },
  { id: "body-out", kind: "out", label: "Body Out", dataType: "any", cardinality: "single" },
  { id: "body-in", kind: "in", label: "Body In", dataType: "any", cardinality: "single" },
  { id: "done", kind: "out", label: "Done", dataType: "any", cardinality: "single" },
];

const loopForEachPorts = [
  ...loopWhilePorts,
  { id: "break", kind: "out", label: "Break", dataType: "any", cardinality: "single" },
];

const loopWhileSpec = {
  kind: "loop-while",
  label: "While Loop",
  icon: "repeat",
  ports: loopWhilePorts,
  capabilities: ["canHaveBackEdge"],
};

const loopForEachSpec = {
  kind: "loop-foreach",
  label: "For Each",
  icon: "repeat",
  ports: loopForEachPorts,
  capabilities: ["canHaveBackEdge"],
};

let currentSpecKind = "loop-while";

function makeStoreMock() {
  const specs: Record<string, unknown> = {
    "loop-while": loopWhileSpec,
    "loop-foreach": loopForEachSpec,
  };
  return (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      openInspector: mockOpenInspector,
      select: mockSelect,
      deleteSelected: mockDeleteSelected,
      updateNodeData: mockUpdateNodeData,
      registry: {
        get: (kind: string) => specs[kind],
      },
      edges: [],
    });
}

vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    makeStoreMock()(selector),
}));

vi.mock("@/features/canvas/KeyboardConnectContext", () => ({
  useStartKeyboardConnect: () => vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  currentSpecKind = "loop-while";
});

function renderLoopNode(overrides: Partial<NodeProps> = {}) {
  const defaults: NodeProps = {
    id: "loop-1",
    type: currentSpecKind,
    data: { condition: "count < 10" },
    selected: false,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    deletable: true,
    selectable: true,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
    dragHandle: undefined,
  } as unknown as NodeProps;
  return render(<LoopNode {...{ ...defaults, ...overrides }} />);
}

describe("Loop inline property editor — integration", () => {
  describe("while-loop (condition)", () => {
    beforeEach(() => {
      currentSpecKind = "loop-while";
    });

    it("displays condition preview as clickable text", () => {
      renderLoopNode({ data: { condition: "x < 10" } });
      const preview = screen.getByTestId("loop-preview");
      expect(preview.textContent).toBe("x < 10");
      expect(preview.getAttribute("role")).toBe("button");
    });

    it("click on preview switches to inline input", () => {
      renderLoopNode({ data: { condition: "x < 10" } });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      expect(screen.getByTestId("loop-inline-input")).toBeInTheDocument();
      expect(screen.queryByTestId("loop-preview")).toBeNull();
    });

    it("inline input shows current condition value", () => {
      renderLoopNode({ data: { condition: "x < 10" } });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      const input = screen.getByTestId("loop-inline-input");
      expect(input.value).toBe("x < 10");
    });

    it("blur commits the edited value via updateNodeData", () => {
      renderLoopNode({ data: { condition: "x < 10" } });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      const input = screen.getByTestId("loop-inline-input");

      act(() => {
        fireEvent.change(input, { target: { value: "y > 5" } });
      });

      act(() => {
        fireEvent.blur(input);
      });

      expect(mockUpdateNodeData).toHaveBeenCalledTimes(1);
      expect(mockUpdateNodeData).toHaveBeenCalledWith("loop-1", {
        condition: "y > 5",
      });
    });

    it("Enter key commits and exits edit mode", () => {
      renderLoopNode({ data: { condition: "x < 10" } });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      const input = screen.getByTestId("loop-inline-input");

      act(() => {
        fireEvent.change(input, { target: { value: "z == 0" } });
      });

      act(() => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(mockUpdateNodeData).toHaveBeenCalledTimes(1);
      expect(mockUpdateNodeData).toHaveBeenCalledWith("loop-1", {
        condition: "z == 0",
      });

      // Should return to preview mode
      expect(screen.getByTestId("loop-preview")).toBeInTheDocument();
      expect(screen.queryByTestId("loop-inline-input")).toBeNull();
    });

    it("Escape key cancels without committing", () => {
      renderLoopNode({ data: { condition: "x < 10" } });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      const input = screen.getByTestId("loop-inline-input");

      act(() => {
        fireEvent.change(input, { target: { value: "changed" } });
      });

      act(() => {
        fireEvent.keyDown(input, { key: "Escape" });
      });

      expect(mockUpdateNodeData).not.toHaveBeenCalled();
      expect(screen.getByTestId("loop-preview")).toBeInTheDocument();
    });

    it("preserves other data fields when committing condition", () => {
      renderLoopNode({
        data: { condition: "x < 10", iterationCount: 5 },
      });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      const input = screen.getByTestId("loop-inline-input");

      act(() => {
        fireEvent.change(input, { target: { value: "x < 20" } });
      });

      act(() => {
        fireEvent.blur(input);
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith("loop-1", {
        condition: "x < 20",
        iterationCount: 5,
      });
    });
  });

  describe("for-each loop (iterable)", () => {
    beforeEach(() => {
      currentSpecKind = "loop-foreach";
    });

    it("displays iterable preview as clickable text", () => {
      renderLoopNode({
        type: "loop-foreach",
        data: { iterable: "items", item: "item" },
      });
      const preview = screen.getByTestId("loop-preview");
      expect(preview.textContent).toBe("item in items");
    });

    it("click on preview switches to inline input with iterable value", () => {
      renderLoopNode({
        type: "loop-foreach",
        data: { iterable: "items", item: "item" },
      });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      const input = screen.getByTestId("loop-inline-input");
      expect(input.value).toBe("items");
    });

    it("blur commits iterable via updateNodeData", () => {
      renderLoopNode({
        type: "loop-foreach",
        data: { iterable: "items", item: "item" },
      });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      const input = screen.getByTestId("loop-inline-input");

      act(() => {
        fireEvent.change(input, { target: { value: "users" } });
      });

      act(() => {
        fireEvent.blur(input);
      });

      expect(mockUpdateNodeData).toHaveBeenCalledTimes(1);
      expect(mockUpdateNodeData).toHaveBeenCalledWith("loop-1", {
        iterable: "users",
        item: "item",
      });
    });

    it("preserves item field when committing iterable", () => {
      renderLoopNode({
        type: "loop-foreach",
        data: { iterable: "items", item: "x" },
      });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      const input = screen.getByTestId("loop-inline-input");

      act(() => {
        fireEvent.change(input, { target: { value: "records" } });
      });

      act(() => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith("loop-1", {
        iterable: "records",
        item: "x",
      });
    });
  });

  describe("sync with store", () => {
    it("updateNodeData is called with correct node id", () => {
      renderLoopNode({ id: "my-loop-42", data: { condition: "a > b" } });

      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });

      act(() => {
        fireEvent.blur(screen.getByTestId("loop-inline-input"));
      });

      expect(mockUpdateNodeData).toHaveBeenCalledWith("my-loop-42", expect.any(Object));
    });

    it("multiple edits each call updateNodeData independently", () => {
      renderLoopNode({ data: { condition: "a" } });

      // First edit
      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });
      act(() => {
        fireEvent.change(screen.getByTestId("loop-inline-input"), {
          target: { value: "b" },
        });
      });
      act(() => {
        fireEvent.keyDown(screen.getByTestId("loop-inline-input"), { key: "Enter" });
      });

      expect(mockUpdateNodeData).toHaveBeenCalledTimes(1);

      // Second edit
      act(() => {
        fireEvent.click(screen.getByTestId("loop-preview"));
      });
      act(() => {
        fireEvent.change(screen.getByTestId("loop-inline-input"), {
          target: { value: "c" },
        });
      });
      act(() => {
        fireEvent.blur(screen.getByTestId("loop-inline-input"));
      });

      expect(mockUpdateNodeData).toHaveBeenCalledTimes(2);
    });
  });
});
