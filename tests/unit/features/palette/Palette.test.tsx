import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, act, cleanup, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { Palette } from "@/features/palette/Palette";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Mock getBoundingClientRect so react-virtual thinks the container has size
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

function setupRegistry() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
  });
  unmount();
}

function renderPalette() {
  return render(
    <DragProvider>
      <Palette />
    </DragProvider>,
  );
}

describe("Palette", () => {
  beforeEach(() => {
    setupRegistry();
  });

  it("renders with complementary role and label", () => {
    renderPalette();
    expect(screen.getByRole("complementary", { name: /node palette/i })).toBeInTheDocument();
  });

  it("renders a listbox with node types label", () => {
    renderPalette();
    expect(screen.getByRole("listbox", { name: /node types/i })).toBeInTheDocument();
  });

  it("renders categories from registry", () => {
    renderPalette();
    expect(screen.getByTestId("palette-category-flow")).toBeInTheDocument();
  });

  it("renders items with role option", () => {
    renderPalette();
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(3);
  });

  it("renders item labels from registry specs", () => {
    renderPalette();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
  });

  it("items have data-kind attribute", () => {
    renderPalette();
    const options = screen.getAllByRole("option");
    const kinds = options.map((el) => el.getAttribute("data-kind"));
    expect(kinds).toContain("start");
    expect(kinds).toContain("task");
    expect(kinds).toContain("end");
  });

  it("category section has a toggle button with aria-expanded", () => {
    renderPalette();
    const categoryDiv = screen.getByTestId("palette-category-flow");
    const button = within(categoryDiv).getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("collapsing a category hides its items", async () => {
    const user = userEvent.setup();
    renderPalette();

    const categoryDiv = screen.getByTestId("palette-category-flow");
    const button = within(categoryDiv).getByRole("button");

    expect(screen.getAllByRole("option").length).toBeGreaterThanOrEqual(3);

    await user.click(button);

    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("keyboard ArrowDown moves focus to next option", async () => {
    const user = userEvent.setup();
    renderPalette();

    const options = screen.getAllByRole("option");
    options[0].focus();
    expect(document.activeElement).toBe(options[0]);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[1]);
  });

  it("keyboard ArrowUp moves focus to previous option", async () => {
    const user = userEvent.setup();
    renderPalette();

    const options = screen.getAllByRole("option");
    options[1].focus();
    expect(document.activeElement).toBe(options[1]);

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options[0]);
  });

  it("ArrowUp on first item does not crash", async () => {
    const user = userEvent.setup();
    renderPalette();

    const options = screen.getAllByRole("option");
    options[0].focus();

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options[0]);
  });

  it("ArrowDown on last item does not crash", async () => {
    const user = userEvent.setup();
    renderPalette();

    const options = screen.getAllByRole("option");
    const last = options[options.length - 1];
    last.focus();

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(last);
  });

  it("virtualization renders only visible items in DOM (not all)", () => {
    // Create a registry with many specs across multiple categories
    const registry = new NodeRegistry();
    const totalItems = 50;
    for (let i = 0; i < totalItems; i++) {
      const cat = `category-${String(Math.floor(i / 10))}`;
      registry.register({
        kind: `node-${String(i)}`,
        category: cat,
        label: `Node ${String(i)}`,
        icon: "box",
        ports: [],
        propertySchema: z.object({}),
        defaultData: {},
        capabilities: [],
      });
    }
    const { result: r2, unmount: u2 } = renderHook(() => useWorkflowStore());
    act(() => {
      r2.current.setRegistry(registry);
    });
    u2();

    // Use a small container height so only a few rows fit
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      return {
        width: 200,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return 100;
      },
    });

    renderPalette();

    const renderedOptions = screen.getAllByRole("option");
    // With 50 items + 5 category headers = 55 rows at 36px each,
    // a 100px container should show far fewer than 50 options
    expect(renderedOptions.length).toBeLessThan(totalItems);
    expect(renderedOptions.length).toBeGreaterThan(0);
  });

  it("renders empty when registry has no specs", () => {
    const { result, unmount } = renderHook(() => useWorkflowStore());
    act(() => {
      result.current.setRegistry(new NodeRegistry());
    });
    unmount();

    renderPalette();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("Enter on focused option dispatches addNode with correct kind and position", async () => {
    const user = userEvent.setup();
    const viewportCenter = { x: 250, y: 175 };
    const getViewportCenter = vi.fn(() => viewportCenter);

    // Clear existing nodes
    const { result: storeResult, unmount: storeUnmount } = renderHook(() => useWorkflowStore());
    act(() => {
      for (const node of storeResult.current.nodes) {
        storeResult.current.removeNode(node.id);
      }
    });
    storeUnmount();

    render(
      <DragProvider>
        <Palette getViewportCenter={getViewportCenter} />
      </DragProvider>,
    );

    const options = screen.getAllByRole("option");
    const firstOption = options[0];
    firstOption.focus();

    await user.keyboard("{Enter}");

    expect(getViewportCenter).toHaveBeenCalled();

    const { result: afterResult, unmount: afterUnmount } = renderHook(() => useWorkflowStore());
    const nodes = afterResult.current.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe(firstOption.getAttribute("data-kind"));
    expect(nodes[0].position).toEqual(viewportCenter);
    afterUnmount();
  });
});
