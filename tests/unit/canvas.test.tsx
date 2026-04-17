import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "@/features/canvas/Canvas";

describe("Canvas", () => {
  it("renders with role=application and accessible name 'Workflow Canvas'", () => {
    render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    );
    const canvas = screen.getByRole("application", { name: /workflow canvas/i });
    expect(canvas).toBeInTheDocument();
  });
});
