import { describe, it, expect } from "vitest";
import config from "../../lint-staged.config.js";

describe("lint-staged config", () => {
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
