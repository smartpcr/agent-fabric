import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DecisionNode } from "@/features/nodes/DecisionNode";
import {
  DecisionSwitchNodeSpec,
  buildSwitchPorts,
} from "@/registry/builtins/DecisionSwitchNode.spec";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { validateSpec } from "@/domain/models/nodeSpec";
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

// Static spec — ports are irrelevant for switch rendering since handles are data-driven
const staticSwitchSpec = {
  kind: "decision-switch",
  variant: "switch",
  icon: "git-branch",
  ports: [{ id: "in", kind: "in", label: "In", dataType: "any", cardinality: "single" }],
};

vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      openInspector: mockOpenInspector,
      select: mockSelect,
      deleteSelected: mockDeleteSelected,
      registry: {
        get: (kind: string) => (kind === "decision-switch" ? staticSwitchSpec : undefined),
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

function renderSwitchNode(
  branches: Array<{ label: string; condition: string }>,
  overrides: Partial<NodeProps> = {},
) {
  const defaults: NodeProps = {
    id: "switch-1",
    type: "decision-switch",
    data: { branches },
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

describe("DecisionSwitchNodeSpec", () => {
  describe("spec shape", () => {
    it("has kind 'decision-switch'", () => {
      expect(DecisionSwitchNodeSpec.kind).toBe("decision-switch");
    });

    it("has variant 'switch'", () => {
      expect(DecisionSwitchNodeSpec.variant).toBe("switch");
    });

    it("has category 'flow'", () => {
      expect(DecisionSwitchNodeSpec.category).toBe("flow");
    });

    it("has label 'Switch'", () => {
      expect(DecisionSwitchNodeSpec.label).toBe("Switch");
    });

    it("passes validateSpec without throwing", () => {
      expect(() => {
        validateSpec(DecisionSwitchNodeSpec);
      }).not.toThrow();
    });

    it("registers cleanly in a NodeRegistry", () => {
      const registry = new NodeRegistry();
      registry.register(DecisionSwitchNodeSpec);
      expect(registry.resolve("decision-switch")).toBe(DecisionSwitchNodeSpec);
    });
  });

  describe("propertySchema", () => {
    const { propertySchema } = DecisionSwitchNodeSpec;

    it("accepts valid branches array", () => {
      const result = propertySchema.safeParse({
        branches: [{ label: "A", condition: "x === 1" }],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty branches array", () => {
      const result = propertySchema.safeParse({ branches: [] });
      expect(result.success).toBe(false);
    });

    it("rejects missing branches", () => {
      const result = propertySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects branch with empty label", () => {
      const result = propertySchema.safeParse({
        branches: [{ label: "", condition: "x" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects branch with empty condition", () => {
      const result = propertySchema.safeParse({
        branches: [{ label: "A", condition: "" }],
      });
      expect(result.success).toBe(false);
    });

    it("defaultData conforms to propertySchema", () => {
      const result = propertySchema.safeParse(DecisionSwitchNodeSpec.defaultData);
      expect(result.success).toBe(true);
    });
  });

  describe("buildSwitchPorts", () => {
    it("always includes an input port", () => {
      const ports = buildSwitchPorts([{ label: "A", condition: "x" }]);
      const inputs = ports.filter((p) => p.kind === "in");
      expect(inputs).toHaveLength(1);
      expect(inputs[0].id).toBe("in");
    });

    it("always includes a default output port", () => {
      const ports = buildSwitchPorts([{ label: "A", condition: "x" }]);
      const defaultPort = ports.find((p) => p.id === "default");
      expect(defaultPort).toBeDefined();
      expect(defaultPort?.kind).toBe("out");
      expect(defaultPort?.label).toBe("default");
    });

    it("creates output ports for each branch", () => {
      const ports = buildSwitchPorts([
        { label: "Case A", condition: "x" },
        { label: "Case B", condition: "y" },
      ]);
      const outputs = ports.filter((p) => p.kind === "out");
      // 2 branches + 1 default = 3 outputs
      expect(outputs).toHaveLength(3);
    });

    it("generates branch port ids from labels", () => {
      const ports = buildSwitchPorts([{ label: "My Case", condition: "x" }]);
      const branchPort = ports.find((p) => p.id === "branch-my-case");
      expect(branchPort).toBeDefined();
      expect(branchPort?.label).toBe("My Case");
    });

    it("default port is always the last output", () => {
      const ports = buildSwitchPorts([
        { label: "A", condition: "x" },
        { label: "B", condition: "y" },
        { label: "C", condition: "z" },
      ]);
      const outputs = ports.filter((p) => p.kind === "out");
      expect(outputs[outputs.length - 1].id).toBe("default");
    });
  });
});

describe("DecisionNode — switch variant rendering", () => {
  describe("with 2 branches", () => {
    const branches = [
      { label: "Case A", condition: "x === 1" },
      { label: "Case B", condition: "x === 2" },
    ];

    it("renders with data-variant='switch'", () => {
      renderSwitchNode(branches);
      const wrapper = screen.getByTestId("decision-node-wrapper");
      expect(wrapper.getAttribute("data-variant")).toBe("switch");
    });

    it("renders an input handle on the left", () => {
      renderSwitchNode(branches);
      const handle = screen.getByTestId("decision-handle-in");
      expect(handle.getAttribute("data-handle-type")).toBe("target");
      expect(handle.getAttribute("data-handle-position")).toBe("left");
    });

    it("renders 2 branch handles + 1 default handle (3 total outputs)", () => {
      renderSwitchNode(branches);
      const branchA = screen.getByTestId("decision-handle-branch-case-a");
      const branchB = screen.getByTestId("decision-handle-branch-case-b");
      const defaultHandle = screen.getByTestId("decision-handle-default");
      expect(branchA).toBeInTheDocument();
      expect(branchB).toBeInTheDocument();
      expect(defaultHandle).toBeInTheDocument();
    });

    it("renders labels for each branch and default", () => {
      renderSwitchNode(branches);
      expect(screen.getByTestId("decision-label-branch-case-a").textContent).toBe("Case A");
      expect(screen.getByTestId("decision-label-branch-case-b").textContent).toBe("Case B");
      expect(screen.getByTestId("decision-label-default").textContent).toBe("default");
    });

    it("always includes 'default' handle", () => {
      renderSwitchNode(branches);
      const defaultHandle = screen.getByTestId("decision-handle-default");
      expect(defaultHandle.getAttribute("data-handle-type")).toBe("source");
    });

    it("shows branch count preview", () => {
      renderSwitchNode(branches);
      const preview = screen.getByTestId("condition-preview");
      expect(preview.textContent).toBe("2 branches");
    });

    it("renders handles with evenly spaced positions", () => {
      renderSwitchNode(branches);
      const branchElements = screen.getAllByTestId(/^switch-branch-/);
      // 3 outputs (2 branches + default) → positions at 25%, 50%, 75%
      const positions = branchElements.map((el) =>
        parseFloat(el.getAttribute("data-branch-position") ?? "0"),
      );
      expect(positions).toHaveLength(3);
      // Each position should be evenly spaced
      const spacing = positions[1] - positions[0];
      for (let i = 2; i < positions.length; i++) {
        expect(Math.abs(positions[i] - positions[i - 1] - spacing)).toBeLessThan(0.1);
      }
    });
  });

  describe("with 3 branches", () => {
    const branches = [
      { label: "Low", condition: "x < 10" },
      { label: "Mid", condition: "x < 50" },
      { label: "High", condition: "x >= 50" },
    ];

    it("renders 3 branch handles + 1 default", () => {
      renderSwitchNode(branches);
      expect(screen.getByTestId("decision-handle-branch-low")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-mid")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-high")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-default")).toBeInTheDocument();
    });

    it("labels are correctly rendered for each branch", () => {
      renderSwitchNode(branches);
      expect(screen.getByTestId("decision-label-branch-low").textContent).toBe("Low");
      expect(screen.getByTestId("decision-label-branch-mid").textContent).toBe("Mid");
      expect(screen.getByTestId("decision-label-branch-high").textContent).toBe("High");
      expect(screen.getByTestId("decision-label-default").textContent).toBe("default");
    });

    it("shows '3 branches' in preview", () => {
      renderSwitchNode(branches);
      expect(screen.getByTestId("condition-preview").textContent).toBe("3 branches");
    });

    it("handles are evenly spaced", () => {
      renderSwitchNode(branches);
      const branchElements = screen.getAllByTestId(/^switch-branch-/);
      expect(branchElements).toHaveLength(4); // 3 branches + default
      const positions = branchElements.map((el) =>
        parseFloat(el.getAttribute("data-branch-position") ?? "0"),
      );
      // 4 outputs → positions at 20%, 40%, 60%, 80%
      const spacing = positions[1] - positions[0];
      for (let i = 2; i < positions.length; i++) {
        expect(Math.abs(positions[i] - positions[i - 1] - spacing)).toBeLessThan(0.1);
      }
    });
  });

  describe("with 5 branches", () => {
    const branches = [
      { label: "A", condition: "v=1" },
      { label: "B", condition: "v=2" },
      { label: "C", condition: "v=3" },
      { label: "D", condition: "v=4" },
      { label: "E", condition: "v=5" },
    ];

    it("renders 5 branch handles + 1 default", () => {
      renderSwitchNode(branches);
      expect(screen.getByTestId("decision-handle-branch-a")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-b")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-c")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-d")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-e")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-default")).toBeInTheDocument();
    });

    it("labels are correctly rendered for all 5 branches + default", () => {
      renderSwitchNode(branches);
      expect(screen.getByTestId("decision-label-branch-a").textContent).toBe("A");
      expect(screen.getByTestId("decision-label-branch-b").textContent).toBe("B");
      expect(screen.getByTestId("decision-label-branch-c").textContent).toBe("C");
      expect(screen.getByTestId("decision-label-branch-d").textContent).toBe("D");
      expect(screen.getByTestId("decision-label-branch-e").textContent).toBe("E");
      expect(screen.getByTestId("decision-label-default").textContent).toBe("default");
    });

    it("shows '5 branches' in preview", () => {
      renderSwitchNode(branches);
      expect(screen.getByTestId("condition-preview").textContent).toBe("5 branches");
    });

    it("handles are evenly spaced", () => {
      renderSwitchNode(branches);
      const branchElements = screen.getAllByTestId(/^switch-branch-/);
      expect(branchElements).toHaveLength(6); // 5 branches + default
      const positions = branchElements.map((el) =>
        parseFloat(el.getAttribute("data-branch-position") ?? "0"),
      );
      // 6 outputs → positions should be evenly spaced
      const spacing = positions[1] - positions[0];
      for (let i = 2; i < positions.length; i++) {
        expect(Math.abs(positions[i] - positions[i - 1] - spacing)).toBeLessThan(0.1);
      }
    });
  });

  describe("default port always present", () => {
    it("has default port with 1 branch", () => {
      renderSwitchNode([{ label: "Only", condition: "x" }]);
      expect(screen.getByTestId("decision-handle-default")).toBeInTheDocument();
      expect(screen.getByTestId("decision-label-default").textContent).toBe("default");
    });

    it("has default port with 5 branches", () => {
      const branches = Array.from({ length: 5 }, (_, i) => ({
        label: `B${String(i)}`,
        condition: `v=${String(i)}`,
      }));
      renderSwitchNode(branches);
      expect(screen.getByTestId("decision-handle-default")).toBeInTheDocument();
    });
  });

  describe("diamond shape", () => {
    it("renders a diamond SVG for switch variant", () => {
      renderSwitchNode([{ label: "A", condition: "x" }]);
      const diamond = screen.getByTestId("decision-diamond");
      expect(diamond).toBeInTheDocument();
      expect(diamond.tagName.toLowerCase()).toBe("svg");
    });

    it("renders 'Switch' title in header", () => {
      renderSwitchNode([{ label: "A", condition: "x" }]);
      const header = screen.getByTestId("node-header");
      expect(header.textContent).toContain("Switch");
    });
  });

  describe("data-driven branch configurability", () => {
    it("renders different handles when data.branches changes (rerender)", () => {
      const { rerender } = renderSwitchNode([
        { label: "X", condition: "v=1" },
        { label: "Y", condition: "v=2" },
      ]);

      // Initially 2 branches + default = 3 outputs
      expect(screen.getByTestId("decision-handle-branch-x")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-y")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-default")).toBeInTheDocument();
      expect(screen.getByTestId("condition-preview").textContent).toBe("2 branches");

      // Rerender with 3 branches (same static spec, different data)
      const props = {
        id: "switch-1",
        type: "decision-switch",
        data: {
          branches: [
            { label: "A", condition: "a" },
            { label: "B", condition: "b" },
            { label: "C", condition: "c" },
          ],
        },
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

      // Now 3 branches + default
      expect(screen.getByTestId("decision-handle-branch-a")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-b")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-c")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-default")).toBeInTheDocument();
      expect(screen.queryByTestId("decision-handle-branch-x")).not.toBeInTheDocument();
      expect(screen.queryByTestId("decision-handle-branch-y")).not.toBeInTheDocument();
      expect(screen.getByTestId("condition-preview").textContent).toBe("3 branches");
    });

    it("renders only default when data.branches is empty", () => {
      renderSwitchNode([]);
      expect(screen.getByTestId("decision-handle-default")).toBeInTheDocument();
      expect(screen.getByTestId("decision-label-default").textContent).toBe("default");
      expect(screen.getByTestId("condition-preview").textContent).toBe("0 branches");
    });

    it("uses static spec for variant detection but data for branch handles", () => {
      // The static spec has only an 'in' port — no output ports in spec
      // But data.branches drives the actual rendered handles
      renderSwitchNode([
        { label: "Alpha", condition: "a" },
        { label: "Beta", condition: "b" },
      ]);
      expect(screen.getByTestId("decision-handle-branch-alpha")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-branch-beta")).toBeInTheDocument();
      expect(screen.getByTestId("decision-handle-default")).toBeInTheDocument();
    });
  });
});
