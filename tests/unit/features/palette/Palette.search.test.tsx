import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, renderHook, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { Palette } from "@/features/palette/Palette";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { useWorkflowStore } from "@/store/hooks";
import type { NodeSpec } from "@/domain/models/nodeSpec";

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

function makeSpec(overrides: Partial<NodeSpec> & { kind: string }): NodeSpec {
  return {
    category: "general",
    label: overrides.kind,
    icon: "box",
    ports: [],
    propertySchema: z.object({}),
    defaultData: {},
    capabilities: [],
    ...overrides,
  };
}

function setupRegistry(specs: NodeSpec[]) {
  const registry = new NodeRegistry();
  for (const spec of specs) {
    registry.register(spec);
  }
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
  });
  unmount();
}

describe("Palette search / filter", () => {
  const testSpecs: NodeSpec[] = [
    makeSpec({ kind: "start", category: "flow", label: "Start" }),
    makeSpec({ kind: "end", category: "flow", label: "End" }),
    makeSpec({ kind: "task", category: "actions", label: "Task" }),
    makeSpec({ kind: "http-request", category: "actions", label: "HTTP Request" }),
    makeSpec({ kind: "transform", category: "data", label: "Transform" }),
  ];

  beforeEach(() => {
    setupRegistry(testSpecs);
  });

  it("renders a search input with accessible label", () => {
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );
    const input = screen.getByRole("searchbox", { name: /search palette/i });
    expect(input).toBeInTheDocument();
  });

  it("shows all items when query is empty", () => {
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(5);
  });

  it("filters items by label (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );

    const input = screen.getByRole("searchbox");
    await user.type(input, "start");

    await vi.waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveAttribute("data-kind", "start");
    });
  });

  it("filters items by category (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );

    const input = screen.getByRole("searchbox");
    await user.type(input, "ACTIONS");

    await vi.waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
    });
  });

  it("filters narrow list — typing resets count", async () => {
    const user = userEvent.setup();
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );

    const input = screen.getByRole("searchbox");

    // First search
    await user.type(input, "flow");
    await vi.waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    // Clear and type new query
    await user.clear(input);
    await user.type(input, "transform");
    await vi.waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
      expect(screen.getByRole("option")).toHaveAttribute("data-kind", "transform");
    });
  });

  it("shows empty-state message when no items match", async () => {
    const user = userEvent.setup();
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );

    const input = screen.getByRole("searchbox");
    await user.type(input, "xyznonexistent");

    await vi.waitFor(() => {
      expect(screen.queryAllByRole("option")).toHaveLength(0);
      expect(screen.getByRole("status")).toHaveTextContent("No matching nodes");
    });
  });

  it("empty query after filtering shows all items again", async () => {
    const user = userEvent.setup();
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );

    const input = screen.getByRole("searchbox");
    await user.type(input, "start");

    await vi.waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
    });

    await user.clear(input);

    await vi.waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(5);
    });
  });

  it("debounces the search (150ms)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );
    const input = screen.getByRole("searchbox");

    // Type rapidly — filter should not apply immediately
    await user.type(input, "s");

    // Before debounce fires, all items should still show
    expect(screen.getAllByRole("option")).toHaveLength(5);

    // Advance past 150ms debounce
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Now the filter should be applied — "s" matches "Start" and "Transform"
    await vi.waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options.length).toBeLessThan(5);
    });

    vi.useRealTimers();
  });

  it("partial label match works", async () => {
    const user = userEvent.setup();
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );

    const input = screen.getByRole("searchbox");
    await user.type(input, "http");

    await vi.waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
      expect(screen.getByRole("option")).toHaveAttribute("data-kind", "http-request");
    });
  });

  it("search is case-insensitive for mixed case input", async () => {
    const user = userEvent.setup();
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );

    const input = screen.getByRole("searchbox");
    await user.type(input, "TaSk");

    await vi.waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(1);
      expect(screen.getByRole("option")).toHaveAttribute("data-kind", "task");
    });
  });

  it("search expands collapsed categories to show matching items", async () => {
    const user = userEvent.setup();
    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );

    // Collapse the "flow" category
    const categoryDiv = screen.getByTestId("palette-category-flow");
    const button = within(categoryDiv).getByRole("button", { hidden: true });
    await user.click(button);

    // Verify flow items are hidden after collapse
    const afterCollapse = screen.getAllByRole("option");
    const flowKinds = afterCollapse
      .map((el) => el.getAttribute("data-kind"))
      .filter((k) => k === "start" || k === "end");
    expect(flowKinds).toHaveLength(0);

    // Search for "Start" which is in the collapsed "flow" category
    const input = screen.getByRole("searchbox");
    await user.type(input, "start");

    await vi.waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveAttribute("data-kind", "start");
    });
  });
});
