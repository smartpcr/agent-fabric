import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DefaultEdge } from "@/features/edges/DefaultEdge";
import type { EdgeProps } from "@xyflow/react";
import type { ReactNode } from "react";

// Mock @xyflow/react — getBezierPath returns midpoint at (50, 75)
vi.mock("@xyflow/react", () => ({
  getBezierPath: vi.fn(() => ["M 0 0 C 50 0 50 100 100 100", 50, 75, 0, 0]),
  BaseEdge: (props: { id?: string; path: string; markerEnd?: string }) => (
    <path data-testid="base-edge" d={props.path} data-marker-end={props.markerEnd} />
  ),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => (
    <div data-testid="edge-label-renderer">{children}</div>
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

describe("DefaultEdge label rendering", () => {
  it("renders a label when data.label is provided", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: { label: "my-label" } })} />
      </svg>,
    );

    const label = screen.getByTestId("edge-label");
    expect(label).toBeInTheDocument();
    expect(label.textContent).toBe("my-label");
  });

  it("does not render a label when data.label is absent", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: {} })} />
      </svg>,
    );

    expect(screen.queryByTestId("edge-label")).toBeNull();
  });

  it("does not render a label when data is undefined", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: undefined })} />
      </svg>,
    );

    expect(screen.queryByTestId("edge-label")).toBeNull();
  });

  it("truncates labels longer than 20 characters with ellipsis", () => {
    const longLabel = "This is a very long edge label text";
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: { label: longLabel } })} />
      </svg>,
    );

    const label = screen.getByTestId("edge-label");
    expect(label.textContent).toBe("This is a very long …");
    expect(label.textContent?.length).toBeLessThanOrEqual(21); // 20 chars + ellipsis
  });

  it("does not truncate labels with exactly 20 characters", () => {
    const exactLabel = "12345678901234567890"; // exactly 20
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: { label: exactLabel } })} />
      </svg>,
    );

    const label = screen.getByTestId("edge-label");
    expect(label.textContent).toBe(exactLabel);
  });

  it("does not truncate labels shorter than 20 characters", () => {
    const shortLabel = "Short";
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: { label: shortLabel } })} />
      </svg>,
    );

    const label = screen.getByTestId("edge-label");
    expect(label.textContent).toBe("Short");
  });

  it("sets title attribute to the full label text for hover tooltip", () => {
    const longLabel = "This is a very long edge label text";
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: { label: longLabel } })} />
      </svg>,
    );

    const label = screen.getByTestId("edge-label");
    expect(label.getAttribute("title")).toBe(longLabel);
  });

  it("sets title attribute on short labels too", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: { label: "Short" } })} />
      </svg>,
    );

    const label = screen.getByTestId("edge-label");
    expect(label.getAttribute("title")).toBe("Short");
  });

  it("positions the label at the midpoint returned by getBezierPath", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: { label: "test" } })} />
      </svg>,
    );

    const label = screen.getByTestId("edge-label");
    const transform = label.style.transform;
    expect(transform).toContain("translate(50px");
    expect(transform).toContain("75px");
  });

  it("renders label inside EdgeLabelRenderer", () => {
    render(
      <svg>
        <DefaultEdge {...makeEdgeProps({ data: { label: "test" } })} />
      </svg>,
    );

    const renderer = screen.getByTestId("edge-label-renderer");
    expect(renderer).toBeInTheDocument();
    const label = screen.getByTestId("edge-label");
    expect(renderer.contains(label)).toBe(true);
  });

  it("exposes MAX_LABEL_LENGTH as a static property", () => {
    expect(DefaultEdge.MAX_LABEL_LENGTH).toBe(20);
  });
});
