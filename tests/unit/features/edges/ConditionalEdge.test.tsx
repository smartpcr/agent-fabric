import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConditionalEdge } from "@/features/edges/ConditionalEdge";
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
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
    type: "conditional",
    animated: false,
    selected: false,
    selectable: true,
    deletable: true,
    data: { condition: "x > 10" },
    style: {},
    ...overrides,
  } as EdgeProps;
}

describe("ConditionalEdge", () => {
  describe("chip rendering", () => {
    it("renders a conditional chip element", () => {
      const { container } = render(
        <svg>
          <ConditionalEdge {...makeEdgeProps()} />
        </svg>,
      );
      const chip = container.querySelector("[data-testid='conditional-chip']");
      expect(chip).not.toBeNull();
    });

    it("displays the condition text from data.condition", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: "status === 'active'" } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.textContent).toBe("status === 'active'");
    });

    it("shows em dash when condition is empty", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: "" } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.textContent).toBe("—");
    });

    it("shows em dash when condition is undefined", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: {} })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.textContent).toBe("—");
    });

    it("shows em dash when data is undefined", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: undefined })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.textContent).toBe("—");
    });
  });

  describe("truncation", () => {
    it("truncates long condition text at 20 characters", () => {
      const longCondition = "thisIsAVeryLongConditionExpression > 42";
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: longCondition } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.textContent).toContain("…");
      expect(chip.textContent?.length).toBeLessThanOrEqual(21);
    });

    it("does not truncate short condition text", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: "x > 5" } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.textContent).toBe("x > 5");
      expect(chip.textContent).not.toContain("…");
    });

    it("does not truncate condition at exactly 20 characters", () => {
      const exactLength = "12345678901234567890"; // 20 chars
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: exactLength } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.textContent).toBe(exactLength);
    });
  });

  describe("hover tooltip", () => {
    it("sets title attribute to full condition when condition exists", () => {
      const condition = "thisIsAVeryLongConditionExpression > 42";
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.getAttribute("title")).toBe(condition);
    });

    it("sets title for short conditions too", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: "x > 5" } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.getAttribute("title")).toBe("x > 5");
    });

    it("has no title when condition is empty", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: "" } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.getAttribute("title")).toBeNull();
    });

    it("has no title when condition is undefined", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: {} })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.getAttribute("title")).toBeNull();
    });
  });

  describe("pill chip styling", () => {
    it("has pill border-radius (9999px) for condition chip", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps()} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.style.borderRadius).toBe("9999px");
    });

    it("has blue-themed styling when condition is present", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: "x" } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.style.background).toBe("rgb(219, 234, 254)");
      expect(chip.style.color).toBe("rgb(30, 64, 175)");
    });

    it("has grey styling when condition is empty", () => {
      render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: "" } })} />
        </svg>,
      );
      const chip = screen.getByTestId("conditional-chip");
      expect(chip.style.background).toBe("rgb(243, 244, 246)");
      expect(chip.style.color).toBe("rgb(107, 114, 128)");
    });
  });

  describe("edge path rendering", () => {
    it("renders a base edge path", () => {
      const { container } = render(
        <svg>
          <ConditionalEdge {...makeEdgeProps()} />
        </svg>,
      );
      const path = container.querySelector("[data-testid='base-edge']");
      expect(path).not.toBeNull();
    });

    it("renders edge with blue stroke when condition is present", () => {
      const { container } = render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: "x" } })} />
        </svg>,
      );
      const path = container.querySelector("[data-testid='base-edge']") as HTMLElement;
      expect(path.style.stroke).toBe("rgb(37, 99, 235)");
    });

    it("renders edge with grey stroke when condition is empty", () => {
      const { container } = render(
        <svg>
          <ConditionalEdge {...makeEdgeProps({ data: { condition: "" } })} />
        </svg>,
      );
      const path = container.querySelector("[data-testid='base-edge']") as HTMLElement;
      expect(path.style.stroke).toBe("rgb(156, 163, 175)");
    });
  });
});
