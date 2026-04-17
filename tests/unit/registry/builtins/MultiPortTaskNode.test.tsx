import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MultiPortTaskNodeSpec } from "@/registry/builtins/MultiPortTaskNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { TaskNode } from "@/features/nodes/TaskNode";
import type { NodeProps } from "@xyflow/react";

// Mock @xyflow/react — render Handle as a div that exposes props
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

// Mock store hooks
vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      registry: { get: () => ({ icon: "cog" }) },
      openInspector: vi.fn(),
      select: vi.fn(),
      deleteSelected: vi.fn(),
    }),
}));

// Mock selector — return multi-port spec when kind is "task-multi"
vi.mock("@/store/selectors/graphSelectors", () => ({
  selectNodeSpec: (_state: unknown, kind: string) => {
    if (kind === "task-multi") {
      // Import inline to avoid circular — return the actual spec shape
      return {
        kind: "task-multi",
        icon: "cog",
        ports: [
          { id: "inA", kind: "in", label: "Input A", dataType: "string", cardinality: "single" },
          { id: "inB", kind: "in", label: "Input B", dataType: "json", cardinality: "single" },
          { id: "outA", kind: "out", label: "Output A", dataType: "string", cardinality: "single" },
          { id: "outB", kind: "out", label: "Output B", dataType: "json", cardinality: "single" },
          { id: "outC", kind: "out", label: "Output C", dataType: "any", cardinality: "single" },
        ],
      };
    }
    return { kind: "task", icon: "cog" };
  },
}));

afterEach(() => {
  cleanup();
});

describe("MultiPortTaskNodeSpec", () => {
  describe("spec shape", () => {
    it("has kind 'task-multi'", () => {
      expect(MultiPortTaskNodeSpec.kind).toBe("task-multi");
    });

    it("has category 'flow'", () => {
      expect(MultiPortTaskNodeSpec.category).toBe("flow");
    });

    it("has label 'Multi-Port Task'", () => {
      expect(MultiPortTaskNodeSpec.label).toBe("Multi-Port Task");
    });

    it("has an icon", () => {
      expect(MultiPortTaskNodeSpec.icon).toBeTruthy();
    });

    it("has exactly 5 ports (2 inputs + 3 outputs)", () => {
      expect(MultiPortTaskNodeSpec.ports).toHaveLength(5);
    });

    it("has 2 input ports", () => {
      const inputs = MultiPortTaskNodeSpec.ports.filter((p) => p.kind === "in");
      expect(inputs).toHaveLength(2);
    });

    it("has 3 output ports", () => {
      const outputs = MultiPortTaskNodeSpec.ports.filter((p) => p.kind === "out");
      expect(outputs).toHaveLength(3);
    });
  });

  describe("input ports", () => {
    it("inA has dataType string", () => {
      const inA = MultiPortTaskNodeSpec.ports.find((p) => p.id === "inA");
      expect(inA).toBeDefined();
      expect(inA?.kind).toBe("in");
      expect(inA?.dataType).toBe("string");
      expect(inA?.label).toBe("Input A");
    });

    it("inB has dataType json", () => {
      const inB = MultiPortTaskNodeSpec.ports.find((p) => p.id === "inB");
      expect(inB).toBeDefined();
      expect(inB?.kind).toBe("in");
      expect(inB?.dataType).toBe("json");
      expect(inB?.label).toBe("Input B");
    });
  });

  describe("output ports", () => {
    it("outA has dataType string", () => {
      const outA = MultiPortTaskNodeSpec.ports.find((p) => p.id === "outA");
      expect(outA).toBeDefined();
      expect(outA?.kind).toBe("out");
      expect(outA?.dataType).toBe("string");
      expect(outA?.label).toBe("Output A");
    });

    it("outB has dataType json", () => {
      const outB = MultiPortTaskNodeSpec.ports.find((p) => p.id === "outB");
      expect(outB).toBeDefined();
      expect(outB?.kind).toBe("out");
      expect(outB?.dataType).toBe("json");
      expect(outB?.label).toBe("Output B");
    });

    it("outC has dataType any", () => {
      const outC = MultiPortTaskNodeSpec.ports.find((p) => p.id === "outC");
      expect(outC).toBeDefined();
      expect(outC?.kind).toBe("out");
      expect(outC?.dataType).toBe("any");
      expect(outC?.label).toBe("Output C");
    });
  });

  describe("port IDs are unique", () => {
    it("all port IDs are distinct", () => {
      const ids = MultiPortTaskNodeSpec.ports.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("propertySchema", () => {
    it("accepts valid data", () => {
      const result = MultiPortTaskNodeSpec.propertySchema.safeParse({
        name: "MyMultiTask",
        params: { key: "value" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts name only (params defaults)", () => {
      const result = MultiPortTaskNodeSpec.propertySchema.safeParse({ name: "MyTask" });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = MultiPortTaskNodeSpec.propertySchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("defaultData", () => {
    it("conforms to propertySchema", () => {
      const result = MultiPortTaskNodeSpec.propertySchema.safeParse(
        MultiPortTaskNodeSpec.defaultData,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("registry integration", () => {
    it("registers cleanly in a NodeRegistry", () => {
      const registry = new NodeRegistry();
      registry.register(MultiPortTaskNodeSpec);
      expect(registry.resolve("task-multi")).toBe(MultiPortTaskNodeSpec);
    });

    it("can coexist with regular TaskNodeSpec", () => {
      const registry = new NodeRegistry();
      registry.register(TaskNodeSpec);
      registry.register(MultiPortTaskNodeSpec);
      expect(registry.has("task")).toBe(true);
      expect(registry.has("task-multi")).toBe(true);
    });
  });

  describe("fixture re-export", () => {
    it("is accessible from tests/fixtures/multiPortSpec", async () => {
      const { MultiPortTaskNodeSpec: fixtureSpec } =
        await import("../../../fixtures/multiPortSpec");
      expect(fixtureSpec).toBe(MultiPortTaskNodeSpec);
    });
  });

  describe("rendering via TaskNode", () => {
    function renderMultiPortTaskNode() {
      const props = {
        id: "multi-1",
        type: "task-multi",
        data: { name: "Multi Task" },
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

    it("renders exactly 5 handles", () => {
      renderMultiPortTaskNode();
      const handles = screen.getAllByTestId(/task-handle-/);
      expect(handles).toHaveLength(5);
    });

    it("renders 2 input (target) handles at top", () => {
      renderMultiPortTaskNode();
      const targets = screen
        .getAllByTestId(/task-handle-/)
        .filter((el) => el.getAttribute("data-handle-type") === "target");
      expect(targets).toHaveLength(2);
      for (const t of targets) {
        expect(t.getAttribute("data-handle-position")).toBe("top");
      }
    });

    it("renders 3 output (source) handles at bottom", () => {
      renderMultiPortTaskNode();
      const sources = screen
        .getAllByTestId(/task-handle-/)
        .filter((el) => el.getAttribute("data-handle-type") === "source");
      expect(sources).toHaveLength(3);
      for (const s of sources) {
        expect(s.getAttribute("data-handle-position")).toBe("bottom");
      }
    });

    it("renders handles with port IDs matching spec", () => {
      renderMultiPortTaskNode();
      const expectedIds = ["inA", "inB", "outA", "outB", "outC"];
      for (const portId of expectedIds) {
        const handle = screen.getByTestId(`task-handle-${portId}`);
        expect(handle).toBeInTheDocument();
        expect(handle.getAttribute("data-port-id")).toBe(portId);
        expect(handle.getAttribute("data-handle-id")).toBe(portId);
      }
    });
  });
});
