import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StartNode } from "@/features/nodes/StartNode";
import type { NodeProps } from "@xyflow/react";

// Mock @xyflow/react — provide Handle + Position used by StartNode
vi.mock("@xyflow/react", () => ({
  Handle: (props: Record<string, unknown>) => (
    <div
      data-testid={props["data-testid"] as string}
      data-handle-type={props.type as string}
      data-handle-position={props.position as string}
    />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

// Mock store hooks for openInspector
const mockOpenInspector = vi.fn();
vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ openInspector: mockOpenInspector }),
}));

afterEach(() => {
  cleanup();
});

function renderStartNode(overrides: Partial<NodeProps> = {}) {
  const defaults: NodeProps = {
    id: "start-1",
    type: "start",
    data: {},
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
  return render(<StartNode {...{ ...defaults, ...overrides }} />);
}

describe("StartNode", () => {
  it("renders with pill shape on base-node", () => {
    renderStartNode();
    const baseNode = screen.getByTestId("base-node");
    expect(baseNode.style.borderRadius).toBe("9999px");
  });

  it("has ARIA label 'Start'", () => {
    renderStartNode();
    const node = screen.getByRole("group", { name: "Start" });
    expect(node).toBeInTheDocument();
  });

  it("renders exactly one handle", () => {
    renderStartNode();
    const handles = screen.getAllByTestId(/handle/);
    expect(handles).toHaveLength(1);
  });

  it("renders a source handle at the bottom position", () => {
    renderStartNode();
    const handle = screen.getByTestId("start-handle-bottom");
    expect(handle.getAttribute("data-handle-type")).toBe("source");
    expect(handle.getAttribute("data-handle-position")).toBe("bottom");
  });

  it("displays the label 'Start' in the header", () => {
    renderStartNode();
    const header = screen.getByTestId("node-header");
    expect(header.textContent).toContain("Start");
  });

  it("forwards selected prop to BaseNode", () => {
    renderStartNode({ selected: true } as Partial<NodeProps>);
    const baseNode = screen.getByTestId("base-node");
    expect(baseNode.getAttribute("aria-selected")).toBe("true");
    expect(baseNode.getAttribute("data-selected")).toBe("true");
  });

  it("defaults to not selected", () => {
    renderStartNode();
    const baseNode = screen.getByTestId("base-node");
    expect(baseNode.getAttribute("aria-selected")).toBe("false");
    expect(baseNode.getAttribute("data-selected")).toBe("false");
  });
});
