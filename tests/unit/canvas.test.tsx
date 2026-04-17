import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "@/features/canvas/Canvas";
import { ToastProvider } from "@/features/editor/Toast";
import { DragProvider } from "@/features/palette/DragContext";

describe("Canvas", () => {
  it("renders with role=application and accessible name 'Workflow Canvas'", () => {
    render(
      <ReactFlowProvider>
        <ToastProvider>
          <DragProvider>
            <Canvas />
          </DragProvider>
        </ToastProvider>
      </ReactFlowProvider>,
    );
    const canvas = screen.getByRole("application", { name: /workflow canvas/i });
    expect(canvas).toBeInTheDocument();
  });
});
