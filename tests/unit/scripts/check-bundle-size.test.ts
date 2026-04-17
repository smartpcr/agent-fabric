/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// The script is an ESM .mjs file — import the pure function
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error .mjs has no type declarations
import { checkBudget as _checkBudget } from "../../../scripts/check-bundle-size.mjs";

// Cast to a known type so ESLint's no-unsafe-call / no-unsafe-assignment rules are satisfied
const checkBudget = _checkBudget as (stats: unknown) => string[];

/* ------------------------------------------------------------------ */
/*  Fixture loader                                                     */
/* ------------------------------------------------------------------ */

const currentDir: string = dirname(fileURLToPath(import.meta.url));
const fixturesDir: string = resolve(currentDir, "fixtures");

function loadFixture(name: string): unknown {
  const raw: string = readFileSync(resolve(fixturesDir, name), "utf8");
  return JSON.parse(raw) as unknown;
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("check-bundle-size", () => {
  describe("checkBudget with fixture stats.json files", () => {
    it("returns no violations for the passing fixture", () => {
      const stats = loadFixture("stats-pass.json");
      const violations = checkBudget(stats);
      expect(violations).toEqual([]);
    });

    it("reports violations for the failing fixture", () => {
      const stats = loadFixture("stats-fail.json");
      const violations = checkBudget(stats);
      expect(violations.length).toBeGreaterThanOrEqual(2);
      expect(violations.some((v) => v.includes("gzip size"))).toBe(true);
      expect(violations.some((v) => v.includes("raw size"))).toBe(true);
    });
  });

  describe("checkBudget edge cases", () => {
    it("passes when sizes are exactly at the limit", () => {
      const stats = {
        chunks: [
          {
            name: "assets/index.js",
            size: 1_048_576, // exactly 1 MB
            gzipSize: 409_600, // exactly 400 KB
            isEntry: true,
          },
        ],
      };
      const violations = checkBudget(stats);
      expect(violations).toEqual([]);
    });

    it("reports an error for missing or malformed stats", () => {
      expect(checkBudget(null)).toHaveLength(1);
      expect(checkBudget(undefined)).toHaveLength(1);
      expect(checkBudget({})).toHaveLength(1);
    });

    it("does not flag non-entry chunks for gzip budget", () => {
      const stats = {
        chunks: [
          {
            name: "assets/vendor.js",
            size: 500_000,
            gzipSize: 450_000, // > 400 KB but not an entry
            isEntry: false,
          },
        ],
      };
      const violations = checkBudget(stats);
      expect(violations).toEqual([]);
    });
  });
});
