import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

describe("CHANGELOG.md — Keep a Changelog format", () => {
  const changelogPath = resolve(ROOT, "CHANGELOG.md");

  it("file exists", () => {
    expect(existsSync(changelogPath)).toBe(true);
  });

  it("has a top-level Changelog heading", () => {
    const content = readFileSync(changelogPath, "utf8");
    expect(content).toMatch(/^# Changelog/m);
  });

  it("references Keep a Changelog format", () => {
    const content = readFileSync(changelogPath, "utf8");
    expect(content).toContain("keepachangelog.com");
  });

  it("references Semantic Versioning", () => {
    const content = readFileSync(changelogPath, "utf8");
    expect(content).toContain("semver.org");
  });

  it("has an [Unreleased] section", () => {
    const content = readFileSync(changelogPath, "utf8");
    expect(content).toMatch(/## \[Unreleased\]/);
  });

  it("uses Keep a Changelog categories (Added, Changed, etc.)", () => {
    const content = readFileSync(changelogPath, "utf8");
    expect(content).toMatch(/### Added/);
  });

  it("includes version link references at the bottom", () => {
    const content = readFileSync(changelogPath, "utf8");
    expect(content).toMatch(/\[Unreleased\]:\s*https?:\/\//);
  });
});

describe("Release workflow — .github/workflows/release.yml", () => {
  const workflowPath = resolve(ROOT, ".github/workflows/release.yml");

  it("file exists", () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  it("triggers on v* tag push", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(content).toContain("tags:");
    expect(content).toMatch(/"v\*"|'v\*'|v\*/);
  });

  it("includes full test matrix (lint, typecheck, test)", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(content).toContain("npm run lint");
    expect(content).toContain("npm run typecheck");
    expect(content).toContain("npm run test:coverage");
  });

  it("includes build and bundle size check", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(content).toContain("npm run build");
    expect(content).toContain("check-bundle-size");
  });

  it("includes Lighthouse CI audit", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(content).toContain("lighthouse-ci-action");
    expect(content).toContain("lighthouserc.json");
  });

  it("includes npm publish step (library mode)", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(content).toContain("npm publish");
    expect(content).toContain("NPM_TOKEN");
  });

  it("includes Docker image push step (app mode)", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(content).toContain("docker/build-push-action");
    expect(content).toContain("ghcr.io");
  });

  it("gates publish on test + build + lighthouse completion", () => {
    const content = readFileSync(workflowPath, "utf8");
    // Both publish jobs should depend on test, build, and lighthouse
    const publishNpmSection = content.substring(content.indexOf("publish-npm:"));
    const publishDockerSection = content.substring(content.indexOf("publish-docker:"));
    expect(publishNpmSection).toContain("needs: [test, build, lighthouse]");
    expect(publishDockerSection).toContain("needs: [test, build, lighthouse]");
  });

  it("publish jobs are conditioned on tag push", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(content).toContain("startsWith(github.ref, 'refs/tags/v')");
  });
});
