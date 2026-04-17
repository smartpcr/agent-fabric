import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import config from "../../lint-staged.config.js";

const pkgPath = resolve(__dirname, "../../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
  "lint-staged": Record<string, string[]>;
};
const pkgConfig = pkg["lint-staged"];

describe("lint-staged config (lint-staged.config.js)", () => {
  it("runs eslint --fix on staged TS/TSX files", () => {
    const tsTsxCommands = config["*.{ts,tsx}"];
    expect(tsTsxCommands).toBeDefined();
    expect(tsTsxCommands).toContain("eslint --fix");
  });

  it("runs prettier --write on staged TS/TSX files", () => {
    const tsTsxCommands = config["*.{ts,tsx}"];
    expect(tsTsxCommands).toContain("prettier --write");
  });

  it("runs vitest related on staged TS/TSX files", () => {
    const tsTsxCommands = config["*.{ts,tsx}"];
    expect(tsTsxCommands).toContain("vitest related --run");
  });

  it("runs prettier --write on staged Markdown files", () => {
    const mdCommands = config["*.md"];
    expect(mdCommands).toBeDefined();
    expect(mdCommands).toContain("prettier --write");
  });

  it("has exactly the expected file globs", () => {
    const globs = Object.keys(config);
    expect(globs).toContain("*.{ts,tsx}");
    expect(globs).toContain("*.md");
    expect(globs).toHaveLength(2);
  });
});

describe("lint-staged config (package.json)", () => {
  it("has a lint-staged key in package.json", () => {
    expect(pkgConfig).toBeDefined();
  });

  it("runs eslint --fix on staged TS/TSX files", () => {
    expect(pkgConfig["*.{ts,tsx}"]).toContain("eslint --fix");
  });

  it("runs prettier --write on staged TS/TSX files", () => {
    expect(pkgConfig["*.{ts,tsx}"]).toContain("prettier --write");
  });

  it("runs vitest related on staged TS/TSX files", () => {
    expect(pkgConfig["*.{ts,tsx}"]).toContain("vitest related --run");
  });

  it("runs prettier --write on staged Markdown files", () => {
    expect(pkgConfig["*.md"]).toContain("prettier --write");
  });

  it("has exactly the expected file globs", () => {
    const globs = Object.keys(pkgConfig);
    expect(globs).toContain("*.{ts,tsx}");
    expect(globs).toContain("*.md");
    expect(globs).toHaveLength(2);
  });
});
