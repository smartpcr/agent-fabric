import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
      registry: {
        get: (kind: string) => specs[kind],
      },
      edges: [],
    });
}

let currentSpecKind = "loop-while";

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

describe("LoopNode (while variant)", () => {
  describe("rendering", () => {
    it("renders the loop node wrapper", () => {
      renderLoopNode();
      expect(screen.getByTestId("loop-node-wrapper")).toBeDefined();
    });

    it("renders the ↻ badge", () => {
      renderLoopNode();
      const badge = screen.getByTestId("loop-badge");
      expect(badge).toBeDefined();
      expect(badge.textContent).toBe("↻");
    });

    it("renders the badge with aria-label", () => {
      renderLoopNode();
      const badge = screen.getByTestId("loop-badge");
      expect(badge.getAttribute("aria-label")).toBe("loop indicator");
    });

    it("renders the base node with rounded rectangle style", () => {
      renderLoopNode();
      const baseNode = screen.getByTestId("base-node");
      expect(baseNode).toBeDefined();
      expect(baseNode.style.borderRadius).toBe("12px");
    });

    it("renders the loop icon", () => {
      renderLoopNode();
      expect(screen.getByTestId("node-icon")).toBeDefined();
    });

    it("displays the node title 'While Loop'", () => {
      renderLoopNode();
      const header = screen.getByTestId("node-header");
      expect(header.textContent).toContain("While Loop");
    });
  });

  describe("handles", () => {
    it("renders input handle 'in'", () => {
      renderLoopNode();
      const handle = screen.getByTestId("loop-handle-in");
      expect(handle).toBeDefined();
      expect(handle.getAttribute("data-handle-type")).toBe("target");
      expect(handle.getAttribute("data-handle-position")).toBe("left");
    });

    it("renders output handle 'body-out'", () => {
      renderLoopNode();
      const handle = screen.getByTestId("loop-handle-body-out");
      expect(handle).toBeDefined();
      expect(handle.getAttribute("data-handle-type")).toBe("source");
      expect(handle.getAttribute("data-handle-position")).toBe("right");
    });

    it("renders input handle 'body-in'", () => {
      renderLoopNode();
      const handle = screen.getByTestId("loop-handle-body-in");
      expect(handle).toBeDefined();
      expect(handle.getAttribute("data-handle-type")).toBe("target");
      expect(handle.getAttribute("data-handle-position")).toBe("left");
    });

    it("renders output handle 'done'", () => {
      renderLoopNode();
      const handle = screen.getByTestId("loop-handle-done");
      expect(handle).toBeDefined();
      expect(handle.getAttribute("data-handle-type")).toBe("source");
      expect(handle.getAttribute("data-handle-position")).toBe("bottom");
    });

    it("renders handle labels", () => {
      renderLoopNode();
      expect(screen.getByTestId("loop-label-body-out").textContent).toBe("body");
      expect(screen.getByTestId("loop-label-body-in").textContent).toBe("back");
      expect(screen.getByTestId("loop-label-done").textContent).toBe("done");
    });

    it("does not render break handle for while variant", () => {
      renderLoopNode();
      expect(screen.queryByTestId("loop-handle-break")).toBeNull();
    });
  });

  describe("condition preview", () => {
    it("displays condition text", () => {
      renderLoopNode({ data: { condition: "x < 5" } });
      expect(screen.getByTestId("loop-preview").textContent).toBe("x < 5");
    });

    it("truncates long conditions", () => {
      renderLoopNode({
        data: { condition: "this is a very long condition expression that exceeds limit" },
      });
      const preview = screen.getByTestId("loop-preview").textContent;
      expect(preview).toContain("…");
      expect(preview?.length).toBeLessThanOrEqual(24);
    });

    it("shows dash when no condition provided", () => {
      renderLoopNode({ data: {} });
      expect(screen.getByTestId("loop-preview").textContent).toBe("—");
    });
  });

  describe("iteration counter slot", () => {
    it("renders empty iteration counter in authoring mode", () => {
      renderLoopNode();
      const counter = screen.getByTestId("loop-iteration-counter");
      expect(counter).toBeDefined();
      expect(counter.textContent).toBe("");
    });

    it("displays iteration count when provided", () => {
      renderLoopNode({ data: { condition: "x < 5", iterationCount: 3 } });
      const counter = screen.getByTestId("loop-iteration-counter");
      expect(counter.textContent).toBe("iteration 3");
    });
  });
});

describe("LoopNode (for-each variant)", () => {
  beforeEach(() => {
    currentSpecKind = "loop-foreach";
  });

  it("renders all while-variant handles plus break", () => {
    renderLoopNode({ type: "loop-foreach", data: { iterable: "users", item: "user" } });
    expect(screen.getByTestId("loop-handle-in")).toBeDefined();
    expect(screen.getByTestId("loop-handle-body-out")).toBeDefined();
    expect(screen.getByTestId("loop-handle-body-in")).toBeDefined();
    expect(screen.getByTestId("loop-handle-done")).toBeDefined();
    expect(screen.getByTestId("loop-handle-break")).toBeDefined();
  });

  it("renders break handle label", () => {
    renderLoopNode({ type: "loop-foreach", data: { iterable: "users", item: "user" } });
    expect(screen.getByTestId("loop-label-break").textContent).toBe("break");
  });

  it("displays iterable preview with item prefix", () => {
    renderLoopNode({ type: "loop-foreach", data: { iterable: "users", item: "user" } });
    expect(screen.getByTestId("loop-preview").textContent).toBe("user in users");
  });

  it("displays iterable preview without item when item is empty", () => {
    renderLoopNode({ type: "loop-foreach", data: { iterable: "items", item: "" } });
    expect(screen.getByTestId("loop-preview").textContent).toBe("items");
  });

  it("displays the node title 'For Each'", () => {
    renderLoopNode({ type: "loop-foreach", data: { iterable: "items" } });
    const header = screen.getByTestId("node-header");
    expect(header.textContent).toContain("For Each");
  });
});
