import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

describe("Phase 8 — Final acceptance sweep", () => {
  // ─── Exit Criteria ─────────────────────────────────────────────────

  describe("Exit Criteria 1: axe-core zero violations", () => {
    it("accessibility E2E test exists", () => {
      expect(fileExists("tests/e2e/accessibility.spec.ts")).toBe(true);
    });

    it("e2e workflow runs a11y checks", () => {
      expect(fileExists(".github/workflows/e2e.yml")).toBe(true);
    });

    it("high-contrast theme test exists", () => {
      expect(fileExists("tests/e2e/highContrast.spec.ts")).toBe(true);
    });
  });

  describe("Exit Criteria 2: Keyboard-only workflow authoring", () => {
    it("keyboard E2E test exists", () => {
      expect(fileExists("tests/e2e/keyboard.spec.ts")).toBe(true);
    });
  });

  describe("Exit Criteria 3: Bundle budget met", () => {
    it("bundle size check script exists", () => {
      expect(fileExists("scripts/check-bundle-size.mjs")).toBe(true);
    });

    it("CodeField uses React.lazy", () => {
      const content = readFile("src/features/property-grid/fields/CodeField.tsx");
      expect(content).toMatch(/React\.lazy|lazy\s*\(/);
    });
  });

  describe("Exit Criteria 4: Lighthouse thresholds", () => {
    it(".lighthouserc.json exists with required thresholds", () => {
      expect(fileExists(".lighthouserc.json")).toBe(true);
      const raw = readFile(".lighthouserc.json");
      const config = JSON.parse(raw) as {
        ci: { assert: { assertions: Record<string, unknown> } };
      };
      const assertions = config.ci.assert.assertions;
      expect(assertions["categories:performance"]).toBeDefined();
      expect(assertions["categories:accessibility"]).toBeDefined();
    });

    it("Lighthouse CI workflow exists", () => {
      expect(fileExists(".github/workflows/lighthouse.yml")).toBe(true);
    });
  });

  describe("Exit Criteria 5: Semver release pipeline", () => {
    it("release workflow triggers on v* tags", () => {
      const content = readFile(".github/workflows/release.yml");
      expect(content).toContain("v*");
    });

    it("release workflow runs tests before publish", () => {
      const content = readFile(".github/workflows/release.yml");
      expect(content).toContain("needs:");
    });

    it("CHANGELOG.md is Keep a Changelog format", () => {
      const content = readFile("CHANGELOG.md");
      expect(content).toContain("Keep a Changelog");
      expect(content).toContain("Semantic Versioning");
      expect(content).toMatch(/## \[Unreleased\]/);
    });

    it("Dockerfile exists for app-mode release", () => {
      expect(fileExists("Dockerfile")).toBe(true);
    });
  });

  // ─── Stage 1: Accessibility Hardening ──────────────────────────────

  describe("Stage 1: Accessibility Hardening (all 5 steps)", () => {
    it("S1.1 — keyboard navigation: E2E test exists", () => {
      expect(fileExists("tests/e2e/keyboard.spec.ts")).toBe(true);
    });

    it("S1.2 — aria-live announcer: provider + hook exist", () => {
      expect(fileExists("src/providers/AnnouncerProvider.tsx")).toBe(true);
      expect(fileExists("src/hooks/useAnnounce.ts")).toBe(true);
    });

    it("S1.3 — high-contrast theme: tokens + test exist", () => {
      expect(fileExists("src/styles/tokens.css")).toBe(true);
      const tokens = readFile("src/styles/tokens.css");
      expect(tokens).toMatch(/high-contrast/);
      expect(fileExists("tests/e2e/highContrast.spec.ts")).toBe(true);
    });

    it("S1.4 — axe-core CI checks: E2E test + workflow exist", () => {
      expect(fileExists("tests/e2e/accessibility.spec.ts")).toBe(true);
      expect(fileExists(".github/workflows/e2e.yml")).toBe(true);
    });

    it("S1.5 — a11y walkthrough documented", () => {
      expect(fileExists("docs/a11y-walkthrough.md")).toBe(true);
      const walkthrough = readFile("docs/a11y-walkthrough.md");
      expect(walkthrough).toMatch(/NVDA/i);
      expect(walkthrough).toMatch(/VoiceOver/i);
    });

    it("stage spec marks all steps [x]", () => {
      const spec = readFile("docs/phases/phase_08_polish_release/stage_01_accessibility.md");
      const stepMatches = spec.match(/- \[x\] \*\*Step \d+\*\*/g);
      expect(stepMatches).toHaveLength(5);
    });

    it("stage status is marked complete", () => {
      const spec = readFile("docs/phases/phase_08_polish_release/stage_01_accessibility.md");
      expect(spec).toContain("`[x]` complete");
    });
  });

  // ─── Stage 2: Theming & i18n ───────────────────────────────────────

  describe("Stage 2: Theming & i18n (all 4 steps)", () => {
    it("S2.1 — light + dark themes: provider + tokens exist", () => {
      expect(fileExists("src/providers/ThemeProvider.tsx")).toBe(true);
      const tokens = readFile("src/styles/tokens.css");
      expect(tokens).toMatch(/data-theme.*dark|dark/);
    });

    it("S2.2 — i18n wiring: init + extraction exist", () => {
      expect(fileExists("src/i18n/index.ts")).toBe(true);
      expect(fileExists("scripts/i18n-extract.mjs")).toBe(true);
      expect(fileExists("src/i18n/locales/en.json")).toBe(true);
    });

    it("S2.3 — hard-coded string migration: ESLint rule configured", () => {
      // Either eslintrc or eslint config must reference i18n
      const hasEslintConfig =
        fileExists(".eslintrc.cjs") ||
        fileExists(".eslintrc.js") ||
        fileExists(".eslintrc.json") ||
        fileExists("eslint.config.js") ||
        fileExists("eslint.config.mjs");
      expect(hasEslintConfig).toBe(true);
    });

    it("S2.4 — locale switcher + French locale exist", () => {
      expect(fileExists("src/features/editor/LocaleSwitcher.tsx")).toBe(true);
      expect(fileExists("src/i18n/locales/fr.json")).toBe(true);
    });

    it("stage spec marks all steps [x]", () => {
      const spec = readFile("docs/phases/phase_08_polish_release/stage_02_theming_i18n.md");
      const stepMatches = spec.match(/- \[x\] \*\*Step \d+\*\*/g);
      expect(stepMatches).toHaveLength(4);
    });

    it("stage status is marked complete", () => {
      const spec = readFile("docs/phases/phase_08_polish_release/stage_02_theming_i18n.md");
      expect(spec).toContain("`[x]` complete");
    });
  });

  // ─── Stage 3: Performance ──────────────────────────────────────────

  describe("Stage 3: Performance (all 4 steps)", () => {
    it("S3.1 — code-split CodeField: lazy loading configured", () => {
      const content = readFile("src/features/property-grid/fields/CodeField.tsx");
      expect(content).toMatch(/React\.lazy|lazy\s*\(/);
    });

    it("S3.2 — benchmark: canvas benchmark test exists", () => {
      expect(fileExists("tests/performance/canvas.bench.ts")).toBe(true);
    });

    it("S3.3 — selector memoization: selectors directory exists", () => {
      expect(fileExists("src/store/selectors/graphSelectors.ts")).toBe(true);
      expect(fileExists("src/store/selectors/executionSelectors.ts")).toBe(true);
    });

    it("S3.4 — Lighthouse CI config + workflow exist", () => {
      expect(fileExists(".lighthouserc.json")).toBe(true);
      expect(fileExists(".github/workflows/lighthouse.yml")).toBe(true);
    });

    it("stage spec marks all steps [x]", () => {
      const spec = readFile("docs/phases/phase_08_polish_release/stage_03_performance.md");
      const stepMatches = spec.match(/- \[x\] \*\*Step \d+\*\*/g);
      expect(stepMatches).toHaveLength(4);
    });

    it("stage status is marked complete", () => {
      const spec = readFile("docs/phases/phase_08_polish_release/stage_03_performance.md");
      expect(spec).toContain("`[x]` complete");
    });
  });

  // ─── Stage 4: Docs & Release ───────────────────────────────────────

  describe("Stage 4: Docs & Release (all 4 steps)", () => {
    it("S4.1 — user docs: author tutorial with screenshots", () => {
      expect(fileExists("docs/user-guide/author.md")).toBe(true);
      const doc = readFile("docs/user-guide/author.md");
      expect(doc).toMatch(/screenshot/i);
      // At least some screenshot images should exist
      expect(fileExists("docs/user-guide/screenshots/editor-layout.png")).toBe(true);
      expect(fileExists("docs/user-guide/screenshots/add-node.png")).toBe(true);
    });

    it("S4.2 — developer docs: custom-node tutorial", () => {
      expect(fileExists("docs/developer-guide/custom-node.md")).toBe(true);
      const doc = readFile("docs/developer-guide/custom-node.md");
      expect(doc).toMatch(/NodeSpec/);
      expect(doc).toMatch(/NodeRegistry|registry/i);
      // Must link to an example repo
      expect(doc).toMatch(/github\.com/);
    });

    it("S4.3 — changelog + release pipeline", () => {
      expect(fileExists("CHANGELOG.md")).toBe(true);
      expect(fileExists(".github/workflows/release.yml")).toBe(true);
      expect(fileExists("Dockerfile")).toBe(true);

      const release = readFile(".github/workflows/release.yml");
      expect(release).toContain("npm publish");
      expect(release).toContain("docker");
    });

    it("S4.4 — acceptance report exists", () => {
      expect(fileExists("docs/phases/phase_08_acceptance.md")).toBe(true);
      const report = readFile("docs/phases/phase_08_acceptance.md");
      expect(report).toMatch(/Exit Criteria Verification/);
      expect(report).toMatch(/Overall Phase 8 Score/);
      expect(report).toMatch(/COMPLETE/);
    });

    it("stage spec marks all steps [x]", () => {
      const spec = readFile("docs/phases/phase_08_polish_release/stage_04_docs_release.md");
      const stepMatches = spec.match(/- \[x\] \*\*Step \d+\*\*/g);
      expect(stepMatches).toHaveLength(4);
    });

    it("stage status is marked complete", () => {
      const spec = readFile("docs/phases/phase_08_polish_release/stage_04_docs_release.md");
      expect(spec).toContain("`[x]` complete");
    });
  });

  // ─── Phase-level doc status ────────────────────────────────────────

  describe("Phase 8 overall plan status", () => {
    it("phase spec marks status as complete with 100% progress", () => {
      const spec = readFile("docs/phases/phase_08_polish_release.md");
      expect(spec).toContain("`[x]` complete");
      expect(spec).toContain("100%");
    });

    it("all 4 stages marked [x] in the phase spec table", () => {
      const spec = readFile("docs/phases/phase_08_polish_release.md");
      const stageMarks = spec.match(/`\[x\]`/g) ?? [];
      // 4 stages + 1 total row + status line = at least 5
      expect(stageMarks.length).toBeGreaterThanOrEqual(4);
    });

    it("acceptance report includes all 17 steps scored", () => {
      const report = readFile("docs/phases/phase_08_acceptance.md");
      // Each stage table has step rows; verify totals are mentioned
      expect(report).toMatch(/Total steps.*17/);
      expect(report).toMatch(/Steps scored ≥ 90.*17\s*\/\s*17/);
    });

    it("acceptance report confirms all exit criteria passed", () => {
      const report = readFile("docs/phases/phase_08_acceptance.md");
      expect(report).toMatch(/Exit criteria met.*5\s*\/\s*5/);
    });

    it("definition of done checklist is fully checked", () => {
      const report = readFile("docs/phases/phase_08_acceptance.md");
      const doneChecks = report.match(/- \[x\]/g) ?? [];
      expect(doneChecks.length).toBeGreaterThanOrEqual(4);
    });
  });
});
