import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MAX_ENTRY_GZIP_BYTES = 400 * 1024; // 400 KB
const MAX_CHUNK_RAW_BYTES = 1024 * 1024; // 1 MB

/**
 * Validate a stats object against the bundle-size budget.
 * Returns an array of violation strings (empty = pass).
 */
export function checkBudget(stats) {
  const violations = [];

  if (!stats || !Array.isArray(stats.chunks)) {
    violations.push("stats.json is missing or has no chunks array.");
    return violations;
  }

  for (const chunk of stats.chunks) {
    if (chunk.isEntry && chunk.gzipSize > MAX_ENTRY_GZIP_BYTES) {
      violations.push(
        `Entry chunk "${chunk.name}" gzip size ${(chunk.gzipSize / 1024).toFixed(1)} KB exceeds ${MAX_ENTRY_GZIP_BYTES / 1024} KB limit.`,
      );
    }
    if (chunk.size > MAX_CHUNK_RAW_BYTES) {
      violations.push(
        `Chunk "${chunk.name}" raw size ${(chunk.size / 1024).toFixed(1)} KB exceeds ${MAX_CHUNK_RAW_BYTES / 1024} KB limit.`,
      );
    }
  }

  return violations;
}

/** CLI entry-point */
export function main() {
  const statsPath = resolve("dist", "stats.json");
  let stats;
  try {
    stats = JSON.parse(readFileSync(statsPath, "utf8"));
  } catch (_err) {
    console.error("FAIL: Could not read " + statsPath);
    process.exit(1);
  }

  const violations = checkBudget(stats);

  if (violations.length > 0) {
    console.error("FAIL: Bundle-size budget exceeded:");
    for (const v of violations) {
      console.error("  - " + v);
    }
    process.exit(1);
  }

  console.log("PASS: Bundle-size budget OK.");
  for (const c of stats.chunks) {
    const label = c.isEntry ? "(entry)" : "       ";
    console.log(
      "  " +
        label +
        " " +
        c.name +
        "  raw=" +
        (c.size / 1024).toFixed(1) +
        " KB  gzip=" +
        (c.gzipSize / 1024).toFixed(1) +
        " KB",
    );
  }
}

// Run CLI when invoked directly
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const argvFile = process.argv[1] ? resolve(process.argv[1]) : "";
if (argvFile && resolve(thisFile) === argvFile) {
  main();
}
