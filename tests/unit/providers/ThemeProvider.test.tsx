import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";

// ── Storage key constant (mirrors the provider) ─────────────────────
const STORAGE_KEY = "agent-fabric:theme";

// ── Mock matchMedia ──────────────────────────────────────────────────

type MediaQueryListener = (e: MediaQueryListEvent) => void;
let mediaQueryListeners: MediaQueryListener[] = [];
let prefersDark = false;

function createMockMatchMedia() {
  mediaQueryListeners = [];
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn((_event: string, handler: MediaQueryListener) => {
        mediaQueryListeners.push(handler);
      }),
      removeEventListener: vi.fn((_event: string, handler: MediaQueryListener) => {
        mediaQueryListeners = mediaQueryListeners.filter((h) => h !== handler);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function simulateSystemThemeChange(dark: boolean) {
  prefersDark = dark;
  const event = { matches: dark } as MediaQueryListEvent;
  for (const listener of mediaQueryListeners) {
    listener(event);
  }
}

// ── Consumer component for testing ──────────────────────────────────

function ThemeConsumer() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button type="button" data-testid="toggle-btn" onClick={toggleTheme}>
        Toggle
      </button>
      <button
        type="button"
        data-testid="set-dark-btn"
        onClick={() => {
          setTheme("dark");
        }}
      >
        Set Dark
      </button>
      <button
        type="button"
        data-testid="set-light-btn"
        onClick={() => {
          setTheme("light");
        }}
      >
        Set Light
      </button>
    </div>
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    prefersDark = false;
    createMockMatchMedia();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    cleanup();
  });

  // ── Initial state ────────────────────────────────────────────────

  it("defaults to light when no localStorage and system prefers light", () => {
    prefersDark = false;
    createMockMatchMedia();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("defaults to dark when no localStorage and system prefers dark", () => {
    prefersDark = true;
    createMockMatchMedia();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("reads persisted theme from localStorage (light)", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    prefersDark = true; // system says dark, but stored overrides
    createMockMatchMedia();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
  });

  it("reads persisted theme from localStorage (dark)", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    prefersDark = false; // system says light, but stored overrides
    createMockMatchMedia();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
  });

  it("ignores invalid localStorage values and falls back to system pref", () => {
    localStorage.setItem(STORAGE_KEY, "neon-pink");
    prefersDark = true;
    createMockMatchMedia();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
  });

  // ── Toggle ───────────────────────────────────────────────────────

  it("toggles theme from light to dark and persists", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");

    await user.click(screen.getByTestId("toggle-btn"));

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("toggles theme from dark to light and persists", async () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    prefersDark = false;
    createMockMatchMedia();

    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");

    await user.click(screen.getByTestId("toggle-btn"));

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  // ── setTheme ─────────────────────────────────────────────────────

  it("setTheme('dark') updates state, DOM, and localStorage", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    await user.click(screen.getByTestId("set-dark-btn"));

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("setTheme('light') updates state, DOM, and localStorage", async () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    prefersDark = false;
    createMockMatchMedia();

    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    await user.click(screen.getByTestId("set-light-btn"));

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  // ── DOM attribute ────────────────────────────────────────────────

  it("sets data-theme attribute on <html> on mount", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    prefersDark = false;
    createMockMatchMedia();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  // ── System preference change ─────────────────────────────────────

  it("responds to system preference change when no explicit user choice stored", () => {
    // No stored preference — should follow system
    prefersDark = false;
    createMockMatchMedia();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");

    // System switches to dark
    act(() => {
      simulateSystemThemeChange(true);
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("ignores system preference change when user has stored a preference", async () => {
    prefersDark = false;
    createMockMatchMedia();

    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    // User explicitly sets light
    await user.click(screen.getByTestId("set-light-btn"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");

    // System switches to dark
    act(() => {
      simulateSystemThemeChange(true);
    });

    // Should stay light because user explicitly chose it
    expect(screen.getByTestId("current-theme").textContent).toBe("light");
  });

  // ── useTheme outside provider ────────────────────────────────────

  it("useTheme throws when used outside ThemeProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      render(<ThemeConsumer />);
    }).toThrow("useTheme must be used within a ThemeProvider");
    spy.mockRestore();
  });

  // ── Cleanup ──────────────────────────────────────────────────────

  it("removes matchMedia listener on unmount", () => {
    prefersDark = false;
    createMockMatchMedia();

    const { unmount } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    const listenerCount = mediaQueryListeners.length;
    expect(listenerCount).toBeGreaterThan(0);

    unmount();

    // Listener should have been removed
    expect(mediaQueryListeners.length).toBeLessThan(listenerCount);
  });
});
