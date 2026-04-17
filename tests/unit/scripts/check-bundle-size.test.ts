import { describe, it, expect } from "vitest";

// The script is an ESM .mjs file — import the pure function
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error .mjs has no type declarations
import { checkBudget } from "../../../scripts/check-bundle-size.mjs";

/* ------------------------------------------------------------------ */
/*  Fixture helpers                                                    */
/* ------------------------------------------------------------------ */

/** A stats.json where everything is well within budget */
const passingStats = {
  chunks: [
    {
      name: "assets/index-abc123.js",
      size: 200_000, // ~195 KB raw
      gzipSize: 60_000, // ~58 KB gzip
      isEntry: true,
    },
    {
      name: "assets/vendor-def456.js",
      size: 500_000, // ~488 KB raw (< 1 MB)
      gzipSize: 150_000,
      isEntry: false,
    },
  ],
};

/** Entry chunk gzip exceeds 400 KB */
const failEntryGzipStats = {
  chunks: [
    {
      name: "assets/index-abc123.js",
      size: 600_000,
      gzipSize: 450_000, // 439 KB > 400 KB
      isEntry: true,
    },
  ],
};

/** Non-entry chunk raw size exceeds 1 MB */
const failChunkRawStats = {
  chunks: [
    {
      name: "assets/vendor-big.js",
      size: 1_100_000, // ~1074 KB > 1024 KB
      gzipSize: 300_000,
      isEntry: false,
    },
  ],
};

/** Both violations at once */
const failBothStats = {
  chunks: [
    {
      name: "assets/index-main.js",
      size: 1_200_000, // raw > 1 MB AND entry gzip > 400 KB
      gzipSize: 500_000,
      isEntry: true,
    },
  ],
};

/** Exactly at the budget limits — should pass */
const edgeCaseStats = {
  chunks: [
    {
      name: "assets/index.js",
      size: 1_048_576, // exactly 1 MB
      gzipSize: 409_600, // exactly 400 KB
      isEntry: true,
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("check-bundle-size", () => {
  describe("checkBudget", () => {
    it("returns no violations when all chunks are within budget", () => {
      const violations = checkBudget(passingStats);
      expect(violations).toEqual([]);
    });

    it("reports a violation when entry chunk gzip exceeds 400 KB", () => {
      const violations = checkBudget(failEntryGzipStats);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("gzip size");
      expect(violations[0]).toContain("exceeds");
      expect(violations[0]).toContain("index-abc123");
    });

    it("reports a violation when any chunk raw size exceeds 1 MB", () => {
      const violations = checkBudget(failChunkRawStats);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("raw size");
      expect(violations[0]).toContain("exceeds");
      expect(violations[0]).toContain("vendor-big");
    });

    it("reports multiple violations when both limits are exceeded", () => {
      const violations = checkBudget(failBothStats);
      expect(violations).toHaveLength(2);
      expect(violations.some((v: string) => v.includes("gzip size"))).toBe(true);
      expect(violations.some((v: string) => v.includes("raw size"))).toBe(true);
    });

    it("passes when sizes are exactly at the limit", () => {
      const violations = checkBudget(edgeCaseStats);
      expect(violations).toEqual([]);
    });

    it("reports an error for missing stats", () => {
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
