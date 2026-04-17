import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DefaultEdge } from "@/features/edges/DefaultEdge";
import type { EdgeProps } from "@xyflow/react";

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  getBezierPath: vi.fn(() => ["M 0 0 C 50 0 50 100 100 100", 50, 50]),
  BaseEdge: (props: {
    id?: string;
    path: string;
    markerEnd?: string;
    style?: React.CSSProperties;
  }) => (
    <path
      data-testid="base-edge"
      d={props.path}
      data-marker-end={props.markerEnd}
      style={props.style}
    />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

afterEach(() => {
  cleanup();
});

function makeEdgeProps(overrides: Partial<EdgeProps> = {}): EdgeProps {
  return {
    id: "edge-1",
    source: "node-a",
    target: "node-b",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "bottom" as never,
    targetPosition: "top" as never,
    type: "default",
    animated: false,
    selected: false,
    selectable: true,
    deletable: true,
    data: {},
    style: {},
    ...overrides,
  } as EdgeProps;
}

describe("DefaultEdge", () => {
  it("renders a bezier path via BaseEdge", () => {
    const { container } = render(
      <svg>
        <DefaultEdge {...makeEdgeProps()} />
      </svg>,
    );

    const pathEl = container.querySelector("[data-testid='base-edge']");
    expect(pathEl).not.toBeNull();
    expect(pathEl?.getAttribute("d")).toBe("M 0 0 C 50 0 50 100 100 100");
  });

  it("sets markerEnd attribute to the arrow marker by default", () => {
    const { container } = render(
      <svg>
        <DefaultEdge {...makeEdgeProps()} />
      </svg>,
    );

    const pathEl = container.querySelector("[data-testid='base-edge']");
    expect(pathEl?.getAttribute("data-marker-end")).toBe("url(#default-edge-arrow)");
  });

  it("uses custom markerEnd when provided via props", () => {
    const { container } = render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ markerEnd: "url(#custom-marker)" })} />
      </svg>,
    );

    const pathEl = container.querySelector("[data-testid='base-edge']");
    expect(pathEl?.getAttribute("data-marker-end")).toBe("url(#custom-marker)");
  });

  it("renders an SVG <defs> block with an arrow <marker>", () => {
    const { container } = render(
      <svg>
        <DefaultEdge {...makeEdgeProps()} />
      </svg>,
    );

    const marker = container.querySelector("marker#default-edge-arrow");
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute("orient")).toBe("auto-start-reverse");
    expect(marker?.getAttribute("markerWidth")).toBe("12");
    expect(marker?.getAttribute("markerHeight")).toBe("12");
  });

  it("renders the arrow path inside the marker", () => {
    const { container } = render(
      <svg>
        <DefaultEdge {...makeEdgeProps()} />
      </svg>,
    );

    const arrowPath = container.querySelector("marker#default-edge-arrow path");
    expect(arrowPath).not.toBeNull();
    expect(arrowPath?.getAttribute("d")).toBe("M 0 0 L 12 6 L 0 12 z");
  });

  it("passes style prop through to BaseEdge", () => {
    const customStyle = { stroke: "red", strokeWidth: 3 };
    const { container } = render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ style: customStyle })} />
      </svg>,
    );

    const pathEl = container.querySelector("[data-testid='base-edge']");
    expect(pathEl?.getAttribute("style")).toContain("stroke: red");
  });

  it("calls getBezierPath with correct source/target coordinates", async () => {
    const { getBezierPath } = await import("@xyflow/react");

    render(
      <svg>
        <DefaultEdge
          {...makeEdgeProps({
            sourceX: 10,
            sourceY: 20,
            targetX: 300,
            targetY: 400,
          })}
        />
      </svg>,
    );

    expect(getBezierPath).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceX: 10,
        sourceY: 20,
        targetX: 300,
        targetY: 400,
      }),
    );
  });

  it("exposes ARROW_MARKER_ID as a static property", () => {
    expect(DefaultEdge.ARROW_MARKER_ID).toBe("default-edge-arrow");
  });
});
