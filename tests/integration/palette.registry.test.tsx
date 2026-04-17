import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, renderHook } from "@testing-library/react";
import { z } from "zod";
import { Palette } from "@/features/palette/Palette";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

const CONTAINER_HEIGHT = 500;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return {
      width: 200,
      height: CONTAINER_HEIGHT,
      top: 0,
      left: 0,
      bottom: CONTAINER_HEIGHT,
      right: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return CONTAINER_HEIGHT;
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const extraSpec: NodeSpec = {
  kind: "http-request",
  category: "actions",
  label: "HTTP Request",
  icon: "globe",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
  ],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: [],
};

function setupRegistry() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  registry.register(extraSpec);
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
  });
  unmount();
}

describe("Integration: registered specs appear grouped in palette", () => {
  beforeEach(() => {
    setupRegistry();
  });

  it("renders at least 3 items from registered builtins", () => {
    render(<Palette />);
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(3);
  });

  it("renders builtin labels: Start, Task, End", () => {
    render(<Palette />);
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
  });

  it("renders the extra spec label: HTTP Request", () => {
    render(<Palette />);
    expect(screen.getByText("HTTP Request")).toBeInTheDocument();
  });

  it("renders items with correct data-kind attributes", () => {
    render(<Palette />);
    const options = screen.getAllByRole("option");
    const kinds = options.map((el) => el.getAttribute("data-kind"));
    expect(kinds).toContain("start");
    expect(kinds).toContain("task");
    expect(kinds).toContain("end");
    expect(kinds).toContain("http-request");
  });

  it("groups items across 2+ categories", () => {
    render(<Palette />);
    // "flow" category contains Start, Task, End
    const flowCategory = screen.getByTestId("palette-category-flow");
    expect(flowCategory).toBeInTheDocument();

    // "actions" category contains HTTP Request
    const actionsCategory = screen.getByTestId("palette-category-actions");
    expect(actionsCategory).toBeInTheDocument();
  });

  it("items within the same category are grouped together", () => {
    render(<Palette />);
    const options = screen.getAllByRole("option");

    // All flow items should appear before or after all actions items (grouped)
    const flowIndices: number[] = [];
    const actionsIndices: number[] = [];

    options.forEach((opt, idx) => {
      const kind = opt.getAttribute("data-kind");
      if (kind === "start" || kind === "task" || kind === "end") {
        flowIndices.push(idx);
      }
      if (kind === "http-request") {
        actionsIndices.push(idx);
      }
    });

    // Flow items should be contiguous
    expect(flowIndices).toHaveLength(3);
    expect(flowIndices[2] - flowIndices[0]).toBe(2);

    // Actions items should not be interleaved with flow items
    expect(actionsIndices).toHaveLength(1);
    const actionsIdx = actionsIndices[0];
    const flowMax = Math.max(...flowIndices);
    const flowMin = Math.min(...flowIndices);
    // Actions should be either all before or all after flow
    expect(actionsIdx < flowMin || actionsIdx > flowMax).toBe(true);
  });

  it("total items count equals 4 (3 builtins + 1 extra)", () => {
    render(<Palette />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(4);
  });
});
