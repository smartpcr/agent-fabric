#!/usr/bin/env node
/**
 * i18n key extraction script.
 *
 * Scans all TypeScript / TSX files under `src/` for calls to `t('...')`,
 * collects the string-literal keys, and merges them into
 * `src/i18n/locales/en.json` (preserving existing values).
 *
 * Usage:
 *   node scripts/i18n-extract.mjs            # default scan
 *   node scripts/i18n-extract.mjs --dry-run  # print without writing
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const LOCALE_FILE = join(SRC, "i18n", "locales", "en.json");

// Match t('some.key') or t("some.key") — single-argument form only
const T_CALL_RE = /\bt\(\s*(['"])([\w.]+)\1\s*\)/g;

/**
 * Recursively collect all .ts / .tsx files under a directory.
 */
function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // skip node_modules / hidden dirs
      if (!entry.startsWith(".") && entry !== "node_modules") {
        collectFiles(full, out);
      }
    } else {
      const ext = extname(entry);
      if (ext === ".ts" || ext === ".tsx") {
        out.push(full);
      }
    }
  }
  return out;
}

/**
 * Set a nested key on an object, creating intermediate objects as needed.
 * Does not overwrite an existing value.
 */
function setNested(obj, key, value) {
  const parts = key.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (!(last in cur)) {
    cur[last] = value;
  }
}

// ── Main ──────────────────────────────────────────────────────────────

const dryRun = process.argv.includes("--dry-run");

// 1. Scan source files for t() calls
const files = collectFiles(SRC);
const keys = new Set();

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  let match;
  while ((match = T_CALL_RE.exec(content)) !== null) {
    keys.add(match[2]);
  }
}

// 2. Load existing locale file (or start fresh)
let existing = {};
try {
  existing = JSON.parse(readFileSync(LOCALE_FILE, "utf-8"));
} catch {
  // file doesn't exist yet — start from scratch
}

// 3. Merge new keys (preserve existing values)
for (const key of [...keys].sort()) {
  setNested(existing, key, key); // default value = key itself
}

// 4. Write
const output = JSON.stringify(existing, null, 2) + "\n";

if (dryRun) {
  console.log(output);
  console.log(`Found ${String(keys.size)} key(s). Dry run — nothing written.`);
} else {
  writeFileSync(LOCALE_FILE, output, "utf-8");
  console.log(`Wrote ${String(keys.size)} key(s) to ${LOCALE_FILE}`);
}
