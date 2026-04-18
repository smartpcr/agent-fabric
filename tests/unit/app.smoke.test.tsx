import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initI18n } from "@/i18n/index";
import { App } from "@/App";

// Mirror what main.tsx does at startup
initI18n();

describe("App", () => {
  it("renders without crash", () => {
    render(<App />);
    expect(screen.getByRole("application", { name: /workflow canvas/i })).toBeInTheDocument();
  });

  it("has i18n initialized at startup", () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe("en");
  });
});
