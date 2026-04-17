import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { TaskNode } from "@/features/nodes/TaskNode";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { MultiPortTaskNodeSpec } from "@/registry/builtins/MultiPortTaskNode.spec";
import { useWorkflowStore } from "@/store/hooks";
import type { NodeProps } from "@xyflow/react";

// Mock @xyflow/react — render Handle as a div that exposes all relevant props
vi.mock("@xyflow/react", () => ({
  Handle: (props: Record<string, unknown>) => (
    <div
      data-testid={props["data-testid"] as string}
      data-handle-type={props.type as string}
      data-handle-position={props.position as string}
      data-handle-id={props.id as string}
      data-port-id={props["data-port-id"] as string}
      aria-label={props["aria-label"] as string}
    />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  SelectionMode: { Partial: "partial", Full: "full" },
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setupRegistryWithMultiPort() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  registry.register(MultiPortTaskNodeSpec);

  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
  });
  unmount();
}

function renderMultiPortTaskNode() {
  const props = {
    id: "multi-1",
    type: "task-multi",
    data: { name: "Multi-Port Task" },
    selected: false,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    deletable: true,
    selectable: true,
  } as unknown as NodeProps;
  return render(<TaskNode {...props} />);
}

describe("Integration: multi-port node renders 5 handles with correct ARIA names", () => {
  beforeEach(() => {
    setupRegistryWithMultiPort();
  });

  it("renders exactly 5 handles", () => {
    renderMultiPortTaskNode();
    const handles = screen.getAllByTestId(/task-handle-/);
    expect(handles).toHaveLength(5);
  });

  it("renders 2 input (target) handles", () => {
    renderMultiPortTaskNode();
    const targets = screen
      .getAllByTestId(/task-handle-/)
      .filter((el) => el.getAttribute("data-handle-type") === "target");
    expect(targets).toHaveLength(2);
  });

  it("renders 3 output (source) handles", () => {
    renderMultiPortTaskNode();
    const sources = screen
      .getAllByTestId(/task-handle-/)
      .filter((el) => el.getAttribute("data-handle-type") === "source");
    expect(sources).toHaveLength(3);
  });

  it("each handle has an aria-label matching the spec port label", () => {
    renderMultiPortTaskNode();
    const expectedLabels: Record<string, string> = {
      inA: "Input A",
      inB: "Input B",
      outA: "Output A",
      outB: "Output B",
      outC: "Output C",
    };

    for (const [portId, label] of Object.entries(expectedLabels)) {
      const handle = screen.getByTestId(`task-handle-${portId}`);
      expect(handle.getAttribute("aria-label")).toBe(label);
    }
  });

  it("all 5 handles are findable by their accessible name", () => {
    renderMultiPortTaskNode();
    const labels = ["Input A", "Input B", "Output A", "Output B", "Output C"];
    for (const label of labels) {
      const handle = screen.getByLabelText(label);
      expect(handle).toBeInTheDocument();
    }
  });

  it("input handles are positioned at top", () => {
    renderMultiPortTaskNode();
    const inA = screen.getByTestId("task-handle-inA");
    const inB = screen.getByTestId("task-handle-inB");
    expect(inA.getAttribute("data-handle-position")).toBe("top");
    expect(inB.getAttribute("data-handle-position")).toBe("top");
  });

  it("output handles are positioned at bottom", () => {
    renderMultiPortTaskNode();
    const outA = screen.getByTestId("task-handle-outA");
    const outB = screen.getByTestId("task-handle-outB");
    const outC = screen.getByTestId("task-handle-outC");
    expect(outA.getAttribute("data-handle-position")).toBe("bottom");
    expect(outB.getAttribute("data-handle-position")).toBe("bottom");
    expect(outC.getAttribute("data-handle-position")).toBe("bottom");
  });

  it("handle IDs match the spec port IDs", () => {
    renderMultiPortTaskNode();
    const expectedIds = ["inA", "inB", "outA", "outB", "outC"];
    for (const portId of expectedIds) {
      const handle = screen.getByTestId(`task-handle-${portId}`);
      expect(handle.getAttribute("data-handle-id")).toBe(portId);
      expect(handle.getAttribute("data-port-id")).toBe(portId);
    }
  });
});
