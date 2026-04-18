import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DecisionNode } from "@/features/nodes/DecisionNode";
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

const mockOpenInspector = vi.fn();
const mockSelect = vi.fn();
const mockDeleteSelected = vi.fn();

const decisionPorts = [
  { id: "in", kind: "in", label: "In", dataType: "any", cardinality: "single" },
  { id: "true", kind: "out", label: "True", dataType: "any", cardinality: "single" },
  { id: "false", kind: "out", label: "False", dataType: "any", cardinality: "single" },
];

const decisionSpec = {
  kind: "decision",
  variant: "if-else",
  icon: "git-branch",
  ports: decisionPorts,
};

vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      openInspector: mockOpenInspector,
      select: mockSelect,
      deleteSelected: mockDeleteSelected,
      registry: {
        get: (kind: string) => (kind === "decision" ? decisionSpec : undefined),
      },
      edges: [],
    }),
}));

vi.mock("@/features/canvas/KeyboardConnectContext", () => ({
  useStartKeyboardConnect: () => vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDecisionNode(overrides: Partial<NodeProps> = {}) {
  const defaults: NodeProps = {
    id: "decision-1",
    type: "decision",
    data: { condition: "x > 10" },
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
  return render(<DecisionNode {...{ ...defaults, ...overrides }} />);
}

describe("DecisionNode", () => {
  describe("diamond shape", () => {
    it("renders a diamond SVG background", () => {
      renderDecisionNode();
      const diamond = screen.getByTestId("decision-diamond");
      expect(diamond).toBeInTheDocument();
      expect(diamond.tagName.toLowerCase()).toBe("svg");
    });

    it("diamond contains a polygon element", () => {
      renderDecisionNode();
      const diamond = screen.getByTestId("decision-diamond");
      const polygon = diamond.querySelector("polygon");
      expect(polygon).not.toBeNull();
    });

    it("diamond polygon has diamond-shaped points", () => {
      renderDecisionNode();
      const diamond = screen.getByTestId("decision-diamond");
      const polygon = diamond.querySelector("polygon");
      const points = polygon?.getAttribute("points") ?? "";
      // Diamond should have 4 points forming a rhombus
      const pointParts = points.split(" ").filter(Boolean);
      expect(pointParts).toHaveLength(4);
    });
  });

  describe("handles", () => {
    it("renders an input handle on the left", () => {
      renderDecisionNode();
      const handle = screen.getByTestId("decision-handle-in");
      expect(handle.getAttribute("data-handle-type")).toBe("target");
      expect(handle.getAttribute("data-handle-position")).toBe("left");
    });

    it("renders a true output handle on the right", () => {
      renderDecisionNode();
      const handle = screen.getByTestId("decision-handle-true");
      expect(handle.getAttribute("data-handle-type")).toBe("source");
      expect(handle.getAttribute("data-handle-position")).toBe("right");
    });

    it("renders a false output handle on the bottom", () => {
      renderDecisionNode();
      const handle = screen.getByTestId("decision-handle-false");
      expect(handle.getAttribute("data-handle-type")).toBe("source");
      expect(handle.getAttribute("data-handle-position")).toBe("bottom");
    });

    it("renders exactly 3 handles (1 in + 2 out)", () => {
      renderDecisionNode();
      const handles = screen.getAllByTestId(/decision-handle/);
      expect(handles).toHaveLength(3);
    });
  });

  describe("labels", () => {
    it("renders a 'true' label for the true branch", () => {
      renderDecisionNode();
      const label = screen.getByTestId("decision-label-true");
      expect(label.textContent).toBe("true");
    });

    it("renders a 'false' label for the false branch", () => {
      renderDecisionNode();
      const label = screen.getByTestId("decision-label-false");
      expect(label.textContent).toBe("false");
    });

    it("true label has green color", () => {
      renderDecisionNode();
      const label = screen.getByTestId("decision-label-true");
      expect(label.style.color).toBe("rgb(22, 163, 74)");
    });

    it("false label has red color", () => {
      renderDecisionNode();
      const label = screen.getByTestId("decision-label-false");
      expect(label.style.color).toBe("rgb(220, 38, 38)");
    });
  });

  describe("condition preview", () => {
    it("displays the condition text from data", () => {
      renderDecisionNode();
      const preview = screen.getByTestId("condition-preview");
      expect(preview.textContent).toBe("x > 10");
    });

    it("shows em dash when condition is empty", () => {
      renderDecisionNode({ data: { condition: "" } } as Partial<NodeProps>);
      const preview = screen.getByTestId("condition-preview");
      expect(preview.textContent).toBe("—");
    });

    it("shows em dash when condition is undefined", () => {
      renderDecisionNode({ data: {} } as Partial<NodeProps>);
      const preview = screen.getByTestId("condition-preview");
      expect(preview.textContent).toBe("—");
    });

    it("truncates long condition text", () => {
      const longCondition = "thisIsAVeryLongConditionExpression > someOtherValue";
      renderDecisionNode({ data: { condition: longCondition } } as Partial<NodeProps>);
      const preview = screen.getByTestId("condition-preview");
      expect(preview.textContent).toContain("…");
      expect(preview.textContent?.length).toBeLessThanOrEqual(24);
    });

    it("does not truncate short condition text", () => {
      renderDecisionNode({ data: { condition: "a > b" } } as Partial<NodeProps>);
      const preview = screen.getByTestId("condition-preview");
      expect(preview.textContent).toBe("a > b");
      expect(preview.textContent).not.toContain("…");
    });

    it("sets title attribute for tooltip on long condition", () => {
      const longCondition = "thisIsAVeryLongConditionExpression > someOtherValue";
      renderDecisionNode({ data: { condition: longCondition } } as Partial<NodeProps>);
      const preview = screen.getByTestId("condition-preview");
      expect(preview.getAttribute("title")).toBe(longCondition);
    });

    it("updates preview when condition data changes", () => {
      const { rerender } = renderDecisionNode();
      expect(screen.getByTestId("condition-preview").textContent).toBe("x > 10");

      const props = {
        id: "decision-1",
        type: "decision",
        data: { condition: "y < 5" },
        selected: false,
        isConnectable: true,
        zIndex: 0,
        positionAbsoluteX: 0,
        positionAbsoluteY: 0,
        dragging: false,
        deletable: true,
        selectable: true,
      } as unknown as NodeProps;
      rerender(<DecisionNode {...props} />);
      expect(screen.getByTestId("condition-preview").textContent).toBe("y < 5");
    });
  });

  describe("base node integration", () => {
    it("renders with title 'Decision' in the header", () => {
      renderDecisionNode();
      const header = screen.getByTestId("node-header");
      expect(header.textContent).toContain("Decision");
    });

    it("has ARIA label 'Decision'", () => {
      renderDecisionNode();
      const node = screen.getByRole("group", { name: "Decision" });
      expect(node).toBeInTheDocument();
    });

    it("forwards selected prop to BaseNode", () => {
      renderDecisionNode({ selected: true } as Partial<NodeProps>);
      const baseNode = screen.getByTestId("base-node");
      expect(baseNode.getAttribute("aria-selected")).toBe("true");
      expect(baseNode.getAttribute("data-selected")).toBe("true");
    });

    it("defaults to not selected", () => {
      renderDecisionNode();
      const baseNode = screen.getByTestId("base-node");
      expect(baseNode.getAttribute("aria-selected")).toBe("false");
      expect(baseNode.getAttribute("data-selected")).toBe("false");
    });

    it("renders the node icon", () => {
      renderDecisionNode();
      const icon = screen.getByTestId("node-icon");
      expect(icon).toBeInTheDocument();
    });
  });
});
