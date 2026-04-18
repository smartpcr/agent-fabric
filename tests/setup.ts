import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// Clear localStorage between tests to prevent graph persistence pollution
beforeEach(() => {
  localStorage.clear();
});

// Polyfill ResizeObserver for jsdom (required by @xyflow/react)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    // eslint-disable-next-line no-empty-function
    observe() {}

    // eslint-disable-next-line no-empty-function
    unobserve() {}

    // eslint-disable-next-line no-empty-function
    disconnect() {}
  };
}
