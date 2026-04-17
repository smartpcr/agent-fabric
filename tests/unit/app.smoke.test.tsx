import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "@/App";

describe("App", () => {
  it("renders without crash", () => {
    render(<App />);
    expect(screen.getByRole("application", { name: /workflow canvas/i })).toBeInTheDocument();
  });
});
