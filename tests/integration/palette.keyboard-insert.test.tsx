import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Palette } from "@/features/palette/Palette";
import { DragProvider } from "@/features/palette/DragContext";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

// Mock @xyflow/react for ConnectedPalette viewport tests
const mockGetViewport = vi.fn(() => ({ x: 0, y: 0, zoom: 1 }));
vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({ getViewport: mockGetViewport }),
}));

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

function setupStore() {
  const registry = new NodeRegistry();
  registerBuiltins(registry);
  const { result, unmount } = renderHook(() => useWorkflowStore());
  act(() => {
    result.current.setRegistry(registry);
    // Clear any existing nodes from prior tests
    for (const node of result.current.nodes) {
      result.current.removeNode(node.id);
    }
  });
  unmount();
}

function getStoreNodes() {
  const { result, unmount } = renderHook(() => useWorkflowStore());
  const nodes = result.current.nodes;
  unmount();
  return nodes;
}

describe("Integration: Palette keyboard insertion", () => {
  beforeEach(() => {
    setupStore();
  });

  it("Enter on focused item dispatches addNode with viewport center position", async () => {
    const user = userEvent.setup();
    const viewportCenter = { x: 400, y: 300 };
    const getViewportCenter = () => viewportCenter;

    render(
      <DragProvider>
        <Palette getViewportCenter={getViewportCenter} />
      </DragProvider>,
    );

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(1);

    const firstOption = options[0];
    firstOption.focus();
    expect(document.activeElement).toBe(firstOption);

    const kind = firstOption.getAttribute("data-kind");
    expect(kind).toBeTruthy();

    await user.keyboard("{Enter}");

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe(kind);
    expect(nodes[0].position).toEqual(viewportCenter);
  });

  it("Enter creates node at default position when no getViewportCenter provided", async () => {
    const user = userEvent.setup();

    render(
      <DragProvider>
        <Palette />
      </DragProvider>,
    );

    const options = screen.getAllByRole("option");
    const firstOption = options[0];
    firstOption.focus();

    const kind = firstOption.getAttribute("data-kind");

    await user.keyboard("{Enter}");

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe(kind);
    expect(nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it("Enter on different items creates nodes with correct kinds", async () => {
    const user = userEvent.setup();
    const viewportCenter = { x: 200, y: 150 };

    render(
      <DragProvider>
        <Palette getViewportCenter={() => viewportCenter} />
      </DragProvider>,
    );

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(3);

    options[0].focus();
    await user.keyboard("{Enter}");

    options[1].focus();
    await user.keyboard("{Enter}");

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(2);
    expect(nodes[0].kind).toBe(options[0].getAttribute("data-kind"));
    expect(nodes[1].kind).toBe(options[1].getAttribute("data-kind"));
    expect(nodes[0].position).toEqual(viewportCenter);
    expect(nodes[1].position).toEqual(viewportCenter);
  });

  it("Enter does nothing when target has no data-kind (e.g. listbox itself)", async () => {
    const user = userEvent.setup();

    render(
      <DragProvider>
        <Palette getViewportCenter={() => ({ x: 0, y: 0 })} />
      </DragProvider>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();

    await user.keyboard("{Enter}");

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(0);
  });

  it("keyboard navigation + Enter inserts the correct node", async () => {
    const user = userEvent.setup();
    const viewportCenter = { x: 100, y: 100 };

    render(
      <DragProvider>
        <Palette getViewportCenter={() => viewportCenter} />
      </DragProvider>,
    );

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(2);

    options[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[1]);

    await user.keyboard("{Enter}");

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe(options[1].getAttribute("data-kind"));
    expect(nodes[0].position).toEqual(viewportCenter);
  });
});

describe("Integration: ConnectedPalette uses useReactFlow viewport", () => {
  beforeEach(() => {
    setupStore();
    mockGetViewport.mockReset();
  });

  it("ConnectedPalette computes position from useReactFlow().getViewport()", async () => {
    // Dynamic import to get ConnectedPalette after mock is in place
    const { ConnectedPalette } = await import("@/features/palette/ConnectedPalette");

    // Simulate a viewport panned to (100, 50) at zoom 2
    mockGetViewport.mockReturnValue({ x: -100, y: -50, zoom: 2 });

    const user = userEvent.setup();

    render(
      <DragProvider>
        <ConnectedPalette />
      </DragProvider>,
    );

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(1);

    options[0].focus();
    await user.keyboard("{Enter}");

    expect(mockGetViewport).toHaveBeenCalled();

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    // Viewport center = (-x + width/2) / zoom, (-y + height/2) / zoom
    // With FALLBACK_WIDTH=800, FALLBACK_HEIGHT=600 (no .react-flow DOM in jsdom):
    // centerX = (100 + 400) / 2 = 250
    // centerY = (50 + 300) / 2 = 175
    expect(nodes[0].position.x).toBeCloseTo(250);
    expect(nodes[0].position.y).toBeCloseTo(175);
  });

  it("ConnectedPalette uses default viewport when not panned", async () => {
    const { ConnectedPalette } = await import("@/features/palette/ConnectedPalette");

    // Default viewport: no pan, zoom 1
    mockGetViewport.mockReturnValue({ x: 0, y: 0, zoom: 1 });

    const user = userEvent.setup();

    render(
      <DragProvider>
        <ConnectedPalette />
      </DragProvider>,
    );

    const options = screen.getAllByRole("option");
    options[0].focus();
    await user.keyboard("{Enter}");

    const nodes = getStoreNodes();
    expect(nodes).toHaveLength(1);
    // centerX = (0 + 400) / 1 = 400, centerY = (0 + 300) / 1 = 300
    expect(nodes[0].position.x).toBeCloseTo(400);
    expect(nodes[0].position.y).toBeCloseTo(300);
  });
});
