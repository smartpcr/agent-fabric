import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, renderHook } from "@testing-library/react";
import { z } from "zod";
import { Palette } from "@/features/palette/Palette";
import { DragProvider } from "@/features/palette/DragContext";
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

function setupBuiltinsOnly() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
  });
  unmount();
}

describe("Integration: builtins appear in palette with correct labels", () => {
  beforeEach(() => {
    setupBuiltinsOnly();
  });

  it("renders exactly 3 items from registered builtins", () => {
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
  });

  it("renders builtin labels: Start, Task, End", () => {
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
  });

  it("items have correct data-kind attributes", () => {
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );
    const options = screen.getAllByRole("option");
    const kinds = options.map((el) => el.getAttribute("data-kind"));
    expect(kinds).toContain("start");
    expect(kinds).toContain("task");
    expect(kinds).toContain("end");
  });

  it("builtins appear under the flow category", () => {
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );
    const flowCategory = screen.getByTestId("palette-category-flow");
    expect(flowCategory).toBeInTheDocument();
  });
});

describe("Integration: multi-category grouping", () => {
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

  beforeEach(() => {
    const registry = new NodeRegistry();
    registerBuiltins(registry);
    registry.register(extraSpec);
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.setRegistry(registry);
    });
    unmount();
  });

  it("groups items across 2+ categories", () => {
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );
    expect(screen.getByTestId("palette-category-flow")).toBeInTheDocument();
    expect(screen.getByTestId("palette-category-actions")).toBeInTheDocument();
  });

  it("items within the same category are contiguous", () => {
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );
    const options = screen.getAllByRole("option");

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

    expect(flowIndices).toHaveLength(3);
    expect(flowIndices[2] - flowIndices[0]).toBe(2);

    expect(actionsIndices).toHaveLength(1);
    const actionsIdx = actionsIndices[0];
    expect(actionsIdx < flowIndices[0] || actionsIdx > flowIndices[2]).toBe(true);
  });
});
