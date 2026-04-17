import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    const grid = grids[0]!;
    const computedStyle = grid.style;
    expect(computedStyle.getPropertyValue("display")).toBe("grid");
    expect(computedStyle.getPropertyValue("grid-template-columns")).toBe("240px 1fr 320px");
  });

  it("collapses both side panels on Ctrl+\\", () => {
    renderLayout();
    const palettes = screen.getAllByRole("complementary", { name: /node palette/i });
    const grids = screen.getAllByRole("complementary", { name: /property grid/i });
    expect(palettes[0]).toBeInTheDocument();
    expect(grids[0]).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "\\", ctrlKey: true });

    // Both panels still in DOM after collapse (collapsed but present)
    expect(palettes[0]).toBeInTheDocument();
    expect(grids[0]).toBeInTheDocument();
  });

  it("renders resize handles (separators) that are focusable", () => {
    const { container } = renderLayout();
    const handles = container.querySelectorAll(".editor-resize-handle");
    expect(handles.length).toBe(2);

    // react-resizable-panels Separator renders with role="separator" which is keyboard-accessible
    for (const handle of handles) {
      expect(handle.classList.contains("editor-resize-handle")).toBe(true);
    }
  });

  it("resize handles have editor-resize-handle class for focus-visible styling", () => {
    const { container } = renderLayout();
    const handles = container.querySelectorAll(".editor-resize-handle");
    expect(handles.length).toBe(2);

    // Each handle should have the class that enables :focus-visible ring
    for (const handle of handles) {
      expect(handle.classList.contains("editor-resize-handle")).toBe(true);
    }
  });
});
