import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TaskNode } from "@/features/nodes/TaskNode";
import type { NodeProps } from "@xyflow/react";

// Mock @xyflow/react — provide Handle + Position used by TaskNode
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

// Mock store hooks — return spec with icon for the "task" kind
const mockOpenInspector = vi.fn();
vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      registry: { get: () => ({ icon: "cog" }) },
      nodeSpecs: { task: { icon: "cog" } },
      openInspector: mockOpenInspector,
    }),
}));

// Mock selector so it returns the spec from mocked state
vi.mock("@/store/selectors/graphSelectors", () => ({
  selectNodeSpec: (_state: unknown, _kind: string) => ({ icon: "cog" }),
}));

afterEach(() => {
  cleanup();
});

function renderTaskNode(overrides: Partial<NodeProps> = {}) {
  const defaults: NodeProps = {
    id: "task-1",
    type: "task",
    data: { name: "My Task" },
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
  return render(<TaskNode {...{ ...defaults, ...overrides }} />);
}

describe("TaskNode", () => {
  it("renders title from data.name", () => {
    renderTaskNode();
    const header = screen.getByTestId("node-header");
    expect(header.textContent).toContain("My Task");
  });

  it("has ARIA label matching data.name", () => {
    renderTaskNode();
    const node = screen.getByRole("group", { name: "My Task" });
    expect(node).toBeInTheDocument();
  });

  it("updates title when data.name changes", () => {
    const { rerender } = renderTaskNode();
    expect(screen.getByTestId("node-header").textContent).toContain("My Task");

    const props = {
      id: "task-1",
      type: "task",
      data: { name: "Renamed" },
      selected: false,
      isConnectable: true,
      zIndex: 0,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      dragging: false,
      deletable: true,
      selectable: true,
    } as unknown as NodeProps;
    rerender(<TaskNode {...props} />);
    expect(screen.getByTestId("node-header").textContent).toContain("Renamed");
  });

  it("renders an input (target) handle at top", () => {
    renderTaskNode();
    const handle = screen.getByTestId("task-handle-top");
    expect(handle.getAttribute("data-handle-type")).toBe("target");
    expect(handle.getAttribute("data-handle-position")).toBe("top");
  });

  it("renders an output (source) handle at bottom", () => {
    renderTaskNode();
    const handle = screen.getByTestId("task-handle-bottom");
    expect(handle.getAttribute("data-handle-type")).toBe("source");
    expect(handle.getAttribute("data-handle-position")).toBe("bottom");
  });

  it("renders exactly two handles (input + output)", () => {
    renderTaskNode();
    const handles = screen.getAllByTestId(/task-handle/);
    expect(handles).toHaveLength(2);
  });

  it("renders an icon from the spec", () => {
    renderTaskNode();
    const icon = screen.getByTestId("node-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.tagName.toLowerCase()).toBe("svg");
  });

  it("forwards selected prop to BaseNode", () => {
    renderTaskNode({ selected: true } as Partial<NodeProps>);
    const baseNode = screen.getByTestId("base-node");
    expect(baseNode.getAttribute("aria-selected")).toBe("true");
    expect(baseNode.getAttribute("data-selected")).toBe("true");
  });

  it("defaults to not selected", () => {
    renderTaskNode();
    const baseNode = screen.getByTestId("base-node");
    expect(baseNode.getAttribute("aria-selected")).toBe("false");
    expect(baseNode.getAttribute("data-selected")).toBe("false");
  });
});
