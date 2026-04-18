import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

interface AssertionOpts {
  minScore: number;
  aggregationMethod: string;
}

interface LighthouseConfig {
  ci: {
    collect: {
      numberOfRuns: number;
      startServerCommand: string;
      startServerReadyPattern: string;
      url: string[];
      settings: {
        preset: string;
        onlyCategories: string[];
        skipAudits: string[];
      };
    };
    assert: {
      assertions: {
        "categories:performance": [string, AssertionOpts];
        "categories:accessibility": [string, AssertionOpts];
        "categories:best-practices": [string, AssertionOpts];
        "categories:seo"?: [string, AssertionOpts];
      };
    };
    upload: {
      target: string;
    };
  };
}

function loadConfig(): LighthouseConfig {
  const cfgPath = resolve(ROOT, ".lighthouserc.json");
  return JSON.parse(readFileSync(cfgPath, "utf8")) as LighthouseConfig;
}

describe("Lighthouse CI configuration", () => {
  const cfgPath = resolve(ROOT, ".lighthouserc.json");

  it("config file exists and is valid JSON", () => {
    expect(existsSync(cfgPath)).toBe(true);
    const raw = readFileSync(cfgPath, "utf8");
    expect(() => JSON.parse(raw) as unknown).not.toThrow();
  });

  it("enforces performance ≥ 0.9", () => {
    const cfg = loadConfig();
    const perf = cfg.ci.assert.assertions["categories:performance"];
    expect(perf[0]).toBe("error");
    expect(perf[1].minScore).toBeGreaterThanOrEqual(0.9);
  });

  it("enforces accessibility ≥ 0.95", () => {
    const cfg = loadConfig();
    const a11y = cfg.ci.assert.assertions["categories:accessibility"];
    expect(a11y[0]).toBe("error");
    expect(a11y[1].minScore).toBeGreaterThanOrEqual(0.95);
  });

  it("enforces best-practices ≥ 0.9", () => {
    const cfg = loadConfig();
    const bp = cfg.ci.assert.assertions["categories:best-practices"];
    expect(bp[0]).toBe("error");
    expect(bp[1].minScore).toBeGreaterThanOrEqual(0.9);
  });

  it("does not assert on SEO (internal app)", () => {
    const cfg = loadConfig();
    expect(cfg.ci.assert.assertions["categories:seo"]).toBeUndefined();
  });

  it("excludes SEO from onlyCategories", () => {
    const cfg = loadConfig();
    const cats = cfg.ci.collect.settings.onlyCategories;
    expect(cats).not.toContain("seo");
    expect(cats).toContain("performance");
    expect(cats).toContain("accessibility");
    expect(cats).toContain("best-practices");
  });

  it("uses median-run aggregation for reliability", () => {
    const cfg = loadConfig();
    const { "categories:seo": _seo, ...active } = cfg.ci.assert.assertions;
    for (const entry of Object.values(active)) {
      expect(entry[1].aggregationMethod).toBe("median-run");
    }
  });
});

describe("Lighthouse CI workflow", () => {
  const wfPath = resolve(ROOT, ".github/workflows/lighthouse.yml");

  it("workflow file exists", () => {
    expect(existsSync(wfPath)).toBe(true);
  });

  it("triggers on push to main and pull_request to main", () => {
    const raw = readFileSync(wfPath, "utf8");
    expect(raw).toContain("push:");
    expect(raw).toContain("branches: [main]");
    expect(raw).toContain("pull_request:");
  });

  it("references .lighthouserc.json config", () => {
    const raw = readFileSync(wfPath, "utf8");
    expect(raw).toContain("configPath: .lighthouserc.json");
  });

  it("includes build step before lighthouse run", () => {
    const raw = readFileSync(wfPath, "utf8");
    const buildIdx = raw.indexOf("npm run build");
    const lhIdx = raw.indexOf("lighthouse-ci-action");
    expect(buildIdx).toBeGreaterThan(-1);
    expect(lhIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeLessThan(lhIdx);
  });
});
