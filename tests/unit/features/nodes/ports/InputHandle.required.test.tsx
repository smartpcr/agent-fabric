import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { InputHandle } from "@/features/nodes/ports/InputHandle";
import { makeInputPort, type PortSpec } from "@/domain/models/port";
import { selectIsPortMissing } from "@/store/selectors/graphSelectors";
import type { WorkflowState } from "@/store/createStore";

// Mock @xyflow/react — render Handle as a div that exposes all props including data-missing
vi.mock("@xyflow/react", () => ({
  Handle: (props: Record<string, unknown>) => (
    <div
      data-testid="xyflow-handle"
      data-handle-type={props.type as string}
      data-handle-position={props.position as string}
      data-handle-id={props.id as string}
      data-port-id={props["data-port-id"] as string}
      data-missing={props["data-missing"] as string | undefined}
      aria-label={props["aria-label"] as string}
      className={props.className as string}
    />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

// Mock useWorkflowStore — calls the selector with a configurable state
let mockState: Partial<WorkflowState> = { edges: [] };

vi.mock("@/store/hooks", () => ({
  useWorkflowStore: (selector: (state: WorkflowState) => unknown) =>
    selector(mockState as WorkflowState),
}));

afterEach(() => {
  cleanup();
  mockState = { edges: [] };
});

describe("InputHandle — required input indicator", () => {
  describe("selectIsPortMissing selector", () => {
    it("returns false when port is not required", () => {
      const state = { edges: [] } as unknown as WorkflowState;
      expect(selectIsPortMissing(state, "node-1", "in", false)).toBe(false);
    });

    it("returns false when required is undefined", () => {
      const state = { edges: [] } as unknown as WorkflowState;
      expect(selectIsPortMissing(state, "node-1", "in", undefined)).toBe(false);
    });

    it("returns true when port is required and has no inbound edge", () => {
      const state = { edges: [] } as unknown as WorkflowState;
      expect(selectIsPortMissing(state, "node-1", "in", true)).toBe(true);
    });

    it("returns false when port is required and has an inbound edge", () => {
      const state = {
        edges: [
          { id: "e1", source: "other", sourcePort: "out", target: "node-1", targetPort: "in" },
        ],
      } as unknown as WorkflowState;
      expect(selectIsPortMissing(state, "node-1", "in", true)).toBe(false);
    });

    it("returns true when edges exist but none target the specified port", () => {
      const state = {
        edges: [
          {
            id: "e1",
            source: "other",
            sourcePort: "out",
            target: "node-1",
            targetPort: "different-port",
          },
        ],
      } as unknown as WorkflowState;
      expect(selectIsPortMissing(state, "node-1", "in", true)).toBe(true);
    });

    it("returns true when edges exist but none target the specified node", () => {
      const state = {
        edges: [
          {
            id: "e1",
            source: "other",
            sourcePort: "out",
            target: "different-node",
            targetPort: "in",
          },
        ],
      } as unknown as WorkflowState;
      expect(selectIsPortMissing(state, "node-1", "in", true)).toBe(true);
    });
  });

  describe("InputHandle component", () => {
    const requiredPort: PortSpec = makeInputPort({
      id: "in-required",
      label: "Required Input",
      dataType: "string",
      required: true,
    });

    const optionalPort: PortSpec = makeInputPort({
      id: "in-optional",
      label: "Optional Input",
      dataType: "string",
    });

    describe("required port without inbound edge", () => {
      beforeEach(() => {
        mockState = { edges: [] };
      });

      it("sets data-missing='true' on required port with no inbound edge", () => {
        render(<InputHandle portSpec={requiredPort} nodeId="node-1" />);
        const handle = screen.getByTestId("xyflow-handle");
        expect(handle.getAttribute("data-missing")).toBe("true");
      });
    });

    describe("required port with inbound edge", () => {
      beforeEach(() => {
        mockState = {
          edges: [
            {
              id: "e1",
              source: "src-node",
              sourcePort: "out",
              target: "node-1",
              targetPort: "in-required",
            },
          ],
        } as Partial<WorkflowState>;
      });

      it("does not set data-missing when required port has an inbound edge", () => {
        render(<InputHandle portSpec={requiredPort} nodeId="node-1" />);
        const handle = screen.getByTestId("xyflow-handle");
        expect(handle.getAttribute("data-missing")).toBeNull();
      });
    });

    describe("optional port without inbound edge", () => {
      beforeEach(() => {
        mockState = { edges: [] };
      });

      it("does not set data-missing on non-required port", () => {
        render(<InputHandle portSpec={optionalPort} nodeId="node-1" />);
        const handle = screen.getByTestId("xyflow-handle");
        expect(handle.getAttribute("data-missing")).toBeNull();
      });
    });

    describe("without nodeId prop", () => {
      it("does not set data-missing when nodeId is not provided", () => {
        render(<InputHandle portSpec={requiredPort} />);
        const handle = screen.getByTestId("xyflow-handle");
        expect(handle.getAttribute("data-missing")).toBeNull();
      });
    });

    describe("edge connected to different port on same node", () => {
      beforeEach(() => {
        mockState = {
          edges: [
            {
              id: "e1",
              source: "src-node",
              sourcePort: "out",
              target: "node-1",
              targetPort: "other-port",
            },
          ],
        } as Partial<WorkflowState>;
      });

      it("still shows data-missing when edge targets different port", () => {
        render(<InputHandle portSpec={requiredPort} nodeId="node-1" />);
        const handle = screen.getByTestId("xyflow-handle");
        expect(handle.getAttribute("data-missing")).toBe("true");
      });
    });

    describe("CSS targeting contract for red outline", () => {
      beforeEach(() => {
        mockState = { edges: [] };
      });

      it("missing required port has port-handle class for CSS selector match", () => {
        render(<InputHandle portSpec={requiredPort} nodeId="node-1" />);
        const handle = screen.getByTestId("xyflow-handle");
        // .port-handle[data-missing="true"] is the CSS selector for red outline
        expect(handle.className).toContain("port-handle");
        expect(handle.getAttribute("data-missing")).toBe("true");
      });

      it("connected required port has port-handle class but no data-missing", () => {
        mockState = {
          edges: [
            {
              id: "e1",
              source: "src-node",
              sourcePort: "out",
              target: "node-1",
              targetPort: "in-required",
            },
          ],
        } as Partial<WorkflowState>;
        render(<InputHandle portSpec={requiredPort} nodeId="node-1" />);
        const handle = screen.getByTestId("xyflow-handle");
        expect(handle.className).toContain("port-handle");
        expect(handle.getAttribute("data-missing")).toBeNull();
      });
    });
  });
});
