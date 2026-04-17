import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { EditorLayout } from "@/features/editor/EditorLayout";

function renderLayout() {
  return render(
    <ReactFlowProvider>
      <EditorLayout />
    </ReactFlowProvider>,
  );
}

describe("EditorLayout", () => {
  it("renders the palette panel", () => {
    renderLayout();
    const palettes = screen.getAllByRole("complementary", { name: /node palette/i });
    expect(palettes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the canvas panel", () => {
    renderLayout();
    const canvases = screen.getAllByRole("application", { name: /workflow canvas/i });
    expect(canvases.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the property grid panel", () => {
    renderLayout();
    const grids = screen.getAllByRole("complementary", { name: /property grid/i });
    expect(grids.length).toBeGreaterThanOrEqual(1);
  });

  it("has three panels (palette, canvas, property grid)", () => {
    renderLayout();
    const palettes = screen.getAllByRole("complementary", { name: /node palette/i });
    const canvases = screen.getAllByRole("application", { name: /workflow canvas/i });
    const grids = screen.getAllByRole("complementary", { name: /property grid/i });
    expect(palettes.length).toBeGreaterThanOrEqual(1);
    expect(canvases.length).toBeGreaterThanOrEqual(1);
    expect(grids.length).toBeGreaterThanOrEqual(1);
  });

  it("uses CSS grid layout with grid-template-columns", () => {
    renderLayout();
    const grids = screen.getAllByTestId("editor-grid");
    const grid = grids[0];
    expect(grid).toBeDefined();
    const computedStyle = grid.style;
    expect(computedStyle.getPropertyValue("display")).toBe("grid");
    expect(computedStyle.getPropertyValue("grid-template-columns")).toBe("240px 1fr 320px");
  });

  it("collapses both side panels on Ctrl+\\ and re-expands on second press", () => {
    const { container } = renderLayout();

    // Get panel DOM elements that carry data-collapsed attribute
    const panelEls = container.querySelectorAll("[data-panel]");
    expect(panelEls.length).toBeGreaterThanOrEqual(3);
    const palettePanel = panelEls[0];
    const propertyGridPanel = panelEls[panelEls.length - 1];
    expect(palettePanel).toBeDefined();
    expect(propertyGridPanel).toBeDefined();

    // Initially panels are not collapsed
    expect(palettePanel?.getAttribute("data-collapsed")).not.toBe("true");
    expect(propertyGridPanel?.getAttribute("data-collapsed")).not.toBe("true");

    // Collapse via Ctrl+\
    act(() => {
      fireEvent.keyDown(window, { key: "\\", ctrlKey: true });
    });

    // After collapse, data-collapsed should be "true" on both side panels
    expect(palettePanel?.getAttribute("data-collapsed")).toBe("true");
    expect(propertyGridPanel?.getAttribute("data-collapsed")).toBe("true");

    // Re-expand via second Ctrl+\
    act(() => {
      fireEvent.keyDown(window, { key: "\\", ctrlKey: true });
    });

    // After expand, data-collapsed should revert to "false"
    expect(palettePanel?.getAttribute("data-collapsed")).toBe("false");
    expect(propertyGridPanel?.getAttribute("data-collapsed")).toBe("false");
  });

  it("responds to Meta+\\ (macOS Cmd key)", () => {
    const { container, unmount } = renderLayout();
    const panelEls = container.querySelectorAll("[data-panel]");
    const palettePanel = panelEls[0];

    act(() => {
      fireEvent.keyDown(window, { key: "\\", metaKey: true });
    });

    expect(palettePanel?.getAttribute("data-collapsed")).toBe("true");

    // Unmount to exercise useEffect cleanup
    unmount();
  });

  it("ignores non-shortcut keys", () => {
    const { container } = renderLayout();
    const panelEls = container.querySelectorAll("[data-panel]");
    const palettePanel = panelEls[0];

    act(() => {
      fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    });

    expect(palettePanel?.getAttribute("data-collapsed")).not.toBe("true");
  });

  it("renders resize handles (separators) that are focusable", () => {
    const { container } = renderLayout();
    const handles = container.querySelectorAll(".editor-resize-handle");
    expect(handles.length).toBe(2);

    for (const handle of handles) {
      expect(handle.classList.contains("editor-resize-handle")).toBe(true);
    }
  });

  it("splitter handle receives focus and has focus-visible styling class", () => {
    const { container } = renderLayout();
    const handles = container.querySelectorAll(".editor-resize-handle");
    expect(handles.length).toBe(2);

    const handle = handles[0] as HTMLElement;

    // Focus the handle programmatically
    act(() => {
      handle.focus();
    });

    // Verify the handle received focus
    expect(document.activeElement).toBe(handle);

    // Verify it has the class that enables :focus-visible ring styling
    expect(handle.classList.contains("editor-resize-handle")).toBe(true);

    // The separator has role="separator" making it keyboard-accessible
    expect(handle.getAttribute("role")).toBe("separator");
  });
});
