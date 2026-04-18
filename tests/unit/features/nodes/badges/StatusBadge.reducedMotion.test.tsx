import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StatusBadge } from "@/features/nodes/badges/StatusBadge";

afterEach(() => {
  cleanup();
});

describe("StatusBadge — running spinner", () => {
  it("applies badge-spin class to the running icon", () => {
    render(<StatusBadge status="running" />);
    const icon = screen.getByTestId("badge-icon-running");
    expect(icon.classList.contains("badge-spin")).toBe(true);
  });

  it("does not apply badge-spin class to non-running statuses", () => {
    const statuses = ["pending", "success", "error", "skipped"] as const;
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      const icon = screen.getByTestId(`badge-icon-${status}`);
      expect(icon.classList.contains("badge-spin")).toBe(false);
      unmount();
    }
  });

  it("running icon is an SVG with badge-spin alongside lucide classes", () => {
    render(<StatusBadge status="running" />);
    const icon = screen.getByTestId("badge-icon-running");
    expect(icon.tagName.toLowerCase()).toBe("svg");
    // badge-spin should coexist with lucide's own classes
    expect(icon.classList.contains("badge-spin")).toBe(true);
    expect(icon.classList.contains("lucide")).toBe(true);
  });
});

describe("StatusBadge — prefers-reduced-motion (CSS verification)", () => {
  const cssPath = resolve(__dirname, "../../../../..", "src/styles/animations.css");
  let cssContent: string;

  beforeEach(() => {
    cssContent = readFileSync(cssPath, "utf-8");
  });

  it("defines a @keyframes badge-spin rule", () => {
    expect(cssContent).toContain("@keyframes badge-spin");
  });

  it("defines a .badge-spin class with animation", () => {
    expect(cssContent).toMatch(/\.badge-spin\s*\{[^}]*animation:\s*badge-spin/);
  });

  it("includes @media (prefers-reduced-motion: reduce) that disables animation", () => {
    expect(cssContent).toContain("@media (prefers-reduced-motion: reduce)");
    // Inside the media query, .badge-spin should have animation: none
    const reducedMotionBlock = cssContent.slice(
      cssContent.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reducedMotionBlock).toContain(".badge-spin");
    expect(reducedMotionBlock).toMatch(/animation:\s*none/);
  });
});

describe("StatusBadge — matchMedia simulation", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("running icon gets badge-spin class regardless of matchMedia (CSS handles disabling)", () => {
    window.matchMedia = (query: string) =>
      ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {
          /* noop */
        },
        removeListener: () => {
          /* noop */
        },
        addEventListener: () => {
          /* noop */
        },
        removeEventListener: () => {
          /* noop */
        },
        dispatchEvent: () => false,
      }) as MediaQueryList;

    render(<StatusBadge status="running" />);
    const icon = screen.getByTestId("badge-icon-running");
    expect(icon.classList.contains("badge-spin")).toBe(true);
  });

  it("non-running status never has badge-spin, even without reduced-motion", () => {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {
          /* noop */
        },
        removeListener: () => {
          /* noop */
        },
        addEventListener: () => {
          /* noop */
        },
        removeEventListener: () => {
          /* noop */
        },
        dispatchEvent: () => false,
      }) as MediaQueryList;

    render(<StatusBadge status="success" />);
    const icon = screen.getByTestId("badge-icon-success");
    expect(icon.classList.contains("badge-spin")).toBe(false);
  });
});
