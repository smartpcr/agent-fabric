import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type Root, type Declaration } from "postcss";

function collectCustomProperties(root: Root, selector: string): string[] {
  const props: string[] = [];
  root.walkRules(selector, (rule) => {
    rule.walkDecls((decl: Declaration) => {
      if (decl.prop.startsWith("--")) {
        props.push(decl.prop);
      }
    });
  });
  return props;
}

describe("tokens.css parsed by PostCSS", () => {
  const tokensPath = resolve(__dirname, "../../src/styles/tokens.css");
  const rawCss = readFileSync(tokensPath, "utf-8");
  let root: Root;

  beforeAll(async () => {
    const result = await postcss([]).process(rawCss, { from: tokensPath });
    root = result.root;
  });

  it("PostCSS parses tokens.css without errors", () => {
    expect(root).toBeDefined();
    expect(root.nodes?.length).toBeGreaterThan(0);
  });

  it("defines color tokens in :root", () => {
    const props = collectCustomProperties(root, ":root");
    expect(props).toContain("--color-bg");
    expect(props).toContain("--color-fg");
    expect(props).toContain("--color-primary");
    expect(props).toContain("--color-secondary");
    expect(props).toContain("--color-muted");
    expect(props).toContain("--color-border");
    expect(props).toContain("--color-surface");
    expect(props).toContain("--color-danger");
    expect(props).toContain("--color-success");
    expect(props).toContain("--color-warning");
  });

  it("defines spacing tokens in :root", () => {
    const props = collectCustomProperties(root, ":root");
    expect(props).toContain("--spacing-xs");
    expect(props).toContain("--spacing-sm");
    expect(props).toContain("--spacing-md");
    expect(props).toContain("--spacing-lg");
    expect(props).toContain("--spacing-xl");
  });

  it("defines radius tokens in :root", () => {
    const props = collectCustomProperties(root, ":root");
    expect(props).toContain("--radius-sm");
    expect(props).toContain("--radius-md");
    expect(props).toContain("--radius-lg");
    expect(props).toContain("--radius-full");
  });

  it("defines shadow tokens in :root", () => {
    const props = collectCustomProperties(root, ":root");
    expect(props).toContain("--shadow-sm");
    expect(props).toContain("--shadow-md");
    expect(props).toContain("--shadow-lg");
  });

  it("defines dark-mode overrides via [data-theme='dark']", () => {
    const darkProps = collectCustomProperties(root, '[data-theme="dark"]');
    expect(darkProps.length).toBeGreaterThan(0);
  });

  it("dark mode overrides color tokens", () => {
    const darkProps = collectCustomProperties(root, '[data-theme="dark"]');
    expect(darkProps).toContain("--color-bg");
    expect(darkProps).toContain("--color-fg");
    expect(darkProps).toContain("--color-primary");
  });
});
