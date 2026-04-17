import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("tokens.css", () => {
  const tokensPath = resolve(__dirname, "../../src/styles/tokens.css");
  const content = readFileSync(tokensPath, "utf-8");

  it("defines color tokens", () => {
    expect(content).toMatch(/--color-bg\s*:/);
    expect(content).toMatch(/--color-fg\s*:/);
    expect(content).toMatch(/--color-primary\s*:/);
    expect(content).toMatch(/--color-secondary\s*:/);
    expect(content).toMatch(/--color-muted\s*:/);
    expect(content).toMatch(/--color-border\s*:/);
    expect(content).toMatch(/--color-surface\s*:/);
    expect(content).toMatch(/--color-danger\s*:/);
    expect(content).toMatch(/--color-success\s*:/);
    expect(content).toMatch(/--color-warning\s*:/);
  });

  it("defines spacing tokens", () => {
    expect(content).toMatch(/--spacing-xs\s*:/);
    expect(content).toMatch(/--spacing-sm\s*:/);
    expect(content).toMatch(/--spacing-md\s*:/);
    expect(content).toMatch(/--spacing-lg\s*:/);
    expect(content).toMatch(/--spacing-xl\s*:/);
  });

  it("defines radius tokens", () => {
    expect(content).toMatch(/--radius-sm\s*:/);
    expect(content).toMatch(/--radius-md\s*:/);
    expect(content).toMatch(/--radius-lg\s*:/);
    expect(content).toMatch(/--radius-full\s*:/);
  });

  it("defines shadow tokens", () => {
    expect(content).toMatch(/--shadow-sm\s*:/);
    expect(content).toMatch(/--shadow-md\s*:/);
    expect(content).toMatch(/--shadow-lg\s*:/);
  });

  it("defines dark-mode overrides via [data-theme='dark']", () => {
    expect(content).toMatch(/\[data-theme="dark"\]/);
  });

  it("dark mode overrides the color tokens", () => {
    const darkBlock = content.slice(content.indexOf('[data-theme="dark"]'));
    expect(darkBlock).toMatch(/--color-bg\s*:/);
    expect(darkBlock).toMatch(/--color-fg\s*:/);
    expect(darkBlock).toMatch(/--color-primary\s*:/);
  });
});
