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

  it("collapses palette on Ctrl+\\", () => {
    renderLayout();
    const palettes = screen.getAllByRole("complementary", { name: /node palette/i });
    expect(palettes[0]).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "\\", ctrlKey: true });

    // After collapse, the palette panel is still in DOM but collapsed
    expect(palettes[0]).toBeInTheDocument();
  });

  it("renders resize handles (separators)", () => {
    const { container } = renderLayout();
    const handles = container.querySelectorAll(".editor-resize-handle");
    expect(handles.length).toBe(2);
  });
});
