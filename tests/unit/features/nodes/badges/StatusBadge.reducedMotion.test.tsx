import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { StatusBadge } from "@/features/nodes/badges/StatusBadge";

afterEach(() => {
  cleanup();
});

// ─── Helper: mock matchMedia to simulate reduced-motion preference ──

function mockMatchMedia(prefersReducedMotion: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = (query: string) =>
    ({
      matches: query === "(prefers-reduced-motion: reduce)" ? prefersReducedMotion : false,
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
  return () => {
    window.matchMedia = original;
  };
}

// ─── Running spinner (no reduced-motion) ────────────────────────────

describe("StatusBadge — running spinner (normal motion)", () => {
  let restoreMatchMedia: () => void;

  beforeEach(() => {
    restoreMatchMedia = mockMatchMedia(false);
  });

  afterEach(() => {
    restoreMatchMedia();
  });

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
    expect(icon.classList.contains("badge-spin")).toBe(true);
    expect(icon.classList.contains("lucide")).toBe(true);
  });
});

// ─── Reduced-motion simulation ──────────────────────────────────────

describe("StatusBadge — prefers-reduced-motion: reduce", () => {
  let restoreMatchMedia: () => void;

  beforeEach(() => {
    restoreMatchMedia = mockMatchMedia(true);
  });

  afterEach(() => {
    restoreMatchMedia();
  });

  it("does NOT apply badge-spin class to running icon under reduced motion", () => {
    render(<StatusBadge status="running" />);
    const icon = screen.getByTestId("badge-icon-running");
    expect(icon.classList.contains("badge-spin")).toBe(false);
  });

  it("still renders the running icon as an SVG (static, no animation class)", () => {
    render(<StatusBadge status="running" />);
    const icon = screen.getByTestId("badge-icon-running");
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.classList.contains("badge-spin")).toBe(false);
    // lucide class should still be present
    expect(icon.classList.contains("lucide")).toBe(true);
  });

  it("still renders the correct label for running status", () => {
    render(<StatusBadge status="running" />);
    const label = screen.getByTestId("badge-label");
    expect(label.textContent).toBe("Running");
  });

  it("non-running statuses also have no badge-spin class", () => {
    const statuses = ["pending", "success", "error", "skipped"] as const;
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      const icon = screen.getByTestId(`badge-icon-${status}`);
      expect(icon.classList.contains("badge-spin")).toBe(false);
      unmount();
    }
  });
});

// ─── CSS file verification ──────────────────────────────────────────

describe("StatusBadge — animations.css structure", () => {
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
    const reducedMotionBlock = cssContent.slice(
      cssContent.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reducedMotionBlock).toContain(".badge-spin");
    expect(reducedMotionBlock).toMatch(/animation:\s*none/);
  });
});
