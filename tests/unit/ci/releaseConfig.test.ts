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

  it("npm publish is not dry-run", () => {
    const content = readFileSync(workflowPath, "utf8");
    const publishSection = content.substring(content.indexOf("publish-npm:"));
    const publishEnd = publishSection.indexOf("publish-docker:");
    const npmSection = publishSection.substring(0, publishEnd > 0 ? publishEnd : undefined);
    expect(npmSection).toContain("npm publish --provenance --access public");
    expect(npmSection).not.toContain("--dry-run");
  });

  it("publish jobs are conditioned on tag push", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(content).toContain("startsWith(github.ref, 'refs/tags/v')");
  });

  it("uses RELEASE_MODE to toggle library vs app publish", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(content).toContain("RELEASE_MODE");
    // npm publish only in library mode
    const npmSection = content.substring(
      content.indexOf("publish-npm:"),
      content.indexOf("publish-docker:"),
    );
    expect(npmSection).toContain("library");
    // Docker publish only in app mode
    const dockerSection = content.substring(content.indexOf("publish-docker:"));
    expect(dockerSection).toContain("app");
  });
});

describe("Dockerfile", () => {
  const dockerfilePath = resolve(ROOT, "Dockerfile");

  it("exists", () => {
    expect(existsSync(dockerfilePath)).toBe(true);
  });

  it("uses multi-stage build with Node.js and nginx", () => {
    const content = readFileSync(dockerfilePath, "utf8");
    expect(content).toContain("FROM node:");
    expect(content).toContain("FROM nginx:");
  });

  it("runs npm run build in the build stage", () => {
    const content = readFileSync(dockerfilePath, "utf8");
    expect(content).toContain("npm run build");
  });

  it("copies dist to nginx html directory", () => {
    const content = readFileSync(dockerfilePath, "utf8");
    expect(content).toContain("/usr/share/nginx/html");
  });

  it("configures SPA fallback for client-side routing", () => {
    const content = readFileSync(dockerfilePath, "utf8");
    expect(content).toContain("try_files");
    expect(content).toContain("index.html");
  });

  it("exposes port 80", () => {
    const content = readFileSync(dockerfilePath, "utf8");
    expect(content).toContain("EXPOSE 80");
  });
});
