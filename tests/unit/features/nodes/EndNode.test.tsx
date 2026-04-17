import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EndNode } from "@/features/nodes/EndNode";
import type { NodeProps } from "@xyflow/react";

// Mock @xyflow/react — provide Handle + Position used by EndNode
vi.mock("@xyflow/react", () => ({
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

// Mock store hooks for openInspector
const mockOpenInspector = vi.fn();
vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ openInspector: mockOpenInspector }),
}));

afterEach(() => {
  cleanup();
});

function renderEndNode(overrides: Partial<NodeProps> = {}) {
  const defaults: NodeProps = {
    id: "end-1",
    type: "end",
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
  return render(<EndNode {...{ ...defaults, ...overrides }} />);
}

describe("EndNode", () => {
  it("renders with pill shape on base-node", () => {
    renderEndNode();
    const baseNode = screen.getByTestId("base-node");
    expect(baseNode.style.borderRadius).toBe("9999px");
  });

  it("has ARIA label 'End'", () => {
    renderEndNode();
    const node = screen.getByRole("group", { name: "End" });
    expect(node).toBeInTheDocument();
  });

  it("renders exactly one handle", () => {
    renderEndNode();
    const handles = screen.getAllByTestId(/handle/);
    expect(handles).toHaveLength(1);
  });

  it("renders a target handle at the top position", () => {
    renderEndNode();
    const handle = screen.getByTestId("end-handle-top");
    expect(handle.getAttribute("data-handle-type")).toBe("target");
    expect(handle.getAttribute("data-handle-position")).toBe("top");
  });

  it("displays the label 'End' in the header", () => {
    renderEndNode();
    const header = screen.getByTestId("node-header");
    expect(header.textContent).toContain("End");
  });

  it("forwards selected prop to BaseNode", () => {
    renderEndNode({ selected: true } as Partial<NodeProps>);
    const baseNode = screen.getByTestId("base-node");
    expect(baseNode.getAttribute("aria-selected")).toBe("true");
    expect(baseNode.getAttribute("data-selected")).toBe("true");
  });

  it("defaults to not selected", () => {
    renderEndNode();
    const baseNode = screen.getByTestId("base-node");
    expect(baseNode.getAttribute("aria-selected")).toBe("false");
    expect(baseNode.getAttribute("data-selected")).toBe("false");
  });
});
