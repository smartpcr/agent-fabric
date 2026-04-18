import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LoopBackEdge } from "@/features/edges/LoopBackEdge";
import type { EdgeProps } from "@xyflow/react";

// Mock @xyflow/react
vi.mock("@xyflow/react", () => ({
  BaseEdge: (props: {
    id?: string;
    path: string;
    markerEnd?: string;
    style?: React.CSSProperties;
    className?: string;
  }) => (
    <path
      data-testid="base-edge"
      d={props.path}
      data-marker-end={props.markerEnd}
      data-class-name={props.className}
      style={props.style}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

afterEach(() => {
  cleanup();
});

function makeEdgeProps(overrides: Partial<EdgeProps> = {}): EdgeProps {
  return {
    id: "edge-loop-1",
    source: "loop-node",
    target: "loop-node",
    sourceX: 200,
    sourceY: 100,
    targetX: 50,
    targetY: 200,
    sourcePosition: "right" as never,
    targetPosition: "left" as never,
    type: "loop-back",
    animated: false,
    selected: false,
    selectable: true,
    deletable: true,
    data: {},
    style: {},
    ...overrides,
  } as EdgeProps;
}

describe("LoopBackEdge", () => {
  describe("path rendering", () => {
    it("renders a BaseEdge with a curved path", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const edge = container.querySelector("[data-testid='base-edge']");
      expect(edge).toBeDefined();
      const d = edge?.getAttribute("d");
      expect(d).toBeDefined();
      // Path should be a cubic bezier (contains C command)
      expect(d).toContain("C");
      // Path should start at source coordinates
      expect(d).toContain("M 200 100");
    });

    it("renders with dashed stroke (strokeDasharray: 6 4)", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const edge = container.querySelector("[data-testid='base-edge']");
      const style = edge?.getAttribute("style");
      expect(style).toContain("stroke-dasharray: 6 4");
    });

    it("renders with indigo stroke color", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const edge = container.querySelector("[data-testid='base-edge']");
      const style = edge?.getAttribute("style");
      expect(style).toContain("stroke");
      // JSDOM converts hex to rgb — #6366f1 = rgb(99, 102, 241)
      expect(style).toContain("rgb(99, 102, 241)");
    });

    it("applies loop-back-edge CSS class", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const edge = container.querySelector("[data-testid='base-edge']");
      expect(edge?.getAttribute("data-class-name")).toBe("loop-back-edge");
    });

    it("uses a custom arrow marker", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const edge = container.querySelector("[data-testid='base-edge']");
      const markerEnd = edge?.getAttribute("data-marker-end");
      expect(markerEnd).toContain("url(#loop-back-edge-arrow)");
    });

    it("renders the arrow marker definition", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const marker = container.querySelector("#loop-back-edge-arrow");
      expect(marker).toBeDefined();
    });
  });

  describe("visual distinction from DefaultEdge", () => {
    it("has different stroke color than DefaultEdge (indigo vs currentColor)", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const edge = container.querySelector("[data-testid='base-edge']");
      const style = edge?.getAttribute("style");
      // JSDOM converts hex to rgb — #6366f1 = rgb(99, 102, 241)
      expect(style).toContain("rgb(99, 102, 241)");
    });

    it("uses dashed stroke unlike DefaultEdge solid stroke", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const edge = container.querySelector("[data-testid='base-edge']");
      const style = edge?.getAttribute("style");
      expect(style).toContain("stroke-dasharray: 6 4");
    });

    it("uses its own marker ID distinct from DefaultEdge", () => {
      expect(LoopBackEdge.ARROW_MARKER_ID).toBe("loop-back-edge-arrow");
    });
  });

  describe("label rendering", () => {
    it("renders default label 'loop' when no label provided", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const label = container.querySelector("[data-testid='loop-back-label']");
      expect(label).toBeDefined();
      expect(label?.textContent).toBe("loop");
    });

    it("renders custom label when provided via label prop", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps({ label: "retry" })} />
        </svg>,
      );
      const label = container.querySelector("[data-testid='loop-back-label']");
      expect(label?.textContent).toBe("retry");
    });

    it("renders custom label from data.label", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps({ data: { label: "iterate" } })} />
        </svg>,
      );
      const label = container.querySelector("[data-testid='loop-back-label']");
      expect(label?.textContent).toBe("iterate");
    });

    it("prefers label prop over data.label", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps({ label: "from-prop", data: { label: "from-data" } })} />
        </svg>,
      );
      const label = container.querySelector("[data-testid='loop-back-label']");
      expect(label?.textContent).toBe("from-prop");
    });

    it("renders label with pill style (borderRadius 9999)", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const label = container.querySelector("[data-testid='loop-back-label']");
      const style = label?.getAttribute("style");
      expect(style).toContain("border-radius: 9999px");
    });

    it("renders label with italic font style", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge {...makeEdgeProps()} />
        </svg>,
      );
      const label = container.querySelector("[data-testid='loop-back-label']");
      const style = label?.getAttribute("style");
      expect(style).toContain("font-style: italic");
    });
  });

  describe("curved routing", () => {
    it("generates different paths for different source/target positions", () => {
      const { container: c1 } = render(
        <svg>
          <LoopBackEdge
            {...makeEdgeProps({ sourceX: 200, sourceY: 50, targetX: 50, targetY: 150 })}
          />
        </svg>,
      );
      const path1 = c1.querySelector("[data-testid='base-edge']")?.getAttribute("d");

      cleanup();

      const { container: c2 } = render(
        <svg>
          <LoopBackEdge
            {...makeEdgeProps({ sourceX: 300, sourceY: 50, targetX: 50, targetY: 250 })}
          />
        </svg>,
      );
      const path2 = c2.querySelector("[data-testid='base-edge']")?.getAttribute("d");

      expect(path1).not.toBe(path2);
    });

    it("path routes outward (control points extend beyond source X)", () => {
      const { container } = render(
        <svg>
          <LoopBackEdge
            {...makeEdgeProps({ sourceX: 200, sourceY: 100, targetX: 50, targetY: 200 })}
          />
        </svg>,
      );
      const d = container.querySelector("[data-testid='base-edge']")?.getAttribute("d");
      expect(d).toBeDefined();
      if (d) {
        // Path format: M 200 100 C cx1 cy1, cx2 cy2, targetX targetY
        const cIndex = d.indexOf("C");
        expect(cIndex).toBeGreaterThan(-1);
        const afterC = d.slice(cIndex + 2).trim();
        const cx1Str = afterC.split(/[\s,]+/)[0];
        if (cx1Str) {
          const cx1 = parseFloat(cx1Str);
          // Control point X should be >= sourceX (routes outward to the right)
          expect(cx1).toBeGreaterThanOrEqual(200);
        }
      }
    });
  });
});
