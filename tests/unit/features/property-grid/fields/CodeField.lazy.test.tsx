import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Tests that verify the code-split configuration for Monaco / CodeField:
 *
 * 1. vite.config.ts has manual chunk for code-field
 * 2. CodeField.tsx uses React.lazy + Suspense
 * 3. Build produces Monaco in a separate chunk
 * 4. Main chunk stays under budget (400 KB gzipped)
 */

const ROOT = resolve(import.meta.dirname, "../../../../..");

describe("CodeField lazy loading", () => {
  it("vite.config.ts configures a manual code-field chunk", () => {
    const viteConfig = readFileSync(resolve(ROOT, "vite.config.ts"), "utf-8");
    expect(viteConfig).toContain("manualChunks");
    expect(viteConfig).toContain('"code-field"');
    expect(viteConfig).toContain("@monaco-editor/react");
  });

  it("CodeField.tsx uses React.lazy for Monaco import", () => {
    const codeField = readFileSync(
      resolve(ROOT, "src/features/property-grid/fields/CodeField.tsx"),
      "utf-8",
    );
    expect(codeField).toContain("lazy(");
    expect(codeField).toContain("import(");
    expect(codeField).toContain("@monaco-editor/react");
  });

  it("CodeField.tsx uses Suspense with a skeleton fallback", () => {
    const codeField = readFileSync(
      resolve(ROOT, "src/features/property-grid/fields/CodeField.tsx"),
      "utf-8",
    );
    expect(codeField).toContain("<Suspense");
    expect(codeField).toContain("CodeFieldSkeleton");
  });

  it("CodeField exports a skeleton placeholder component", async () => {
    const mod = await import("@/features/property-grid/fields/CodeField");
    expect(typeof mod.CodeFieldSkeleton).toBe("function");
  });
});

describe("CodeField build output", () => {
  it("build produces a code-field chunk separate from main", () => {
    // Run build
    execSync("npx vite build", { cwd: ROOT, encoding: "utf-8", timeout: 120000 });

    const distDir = resolve(ROOT, "dist", "assets");
    expect(existsSync(distDir)).toBe(true);

    const files = readdirSync(distDir);
    const codeFieldChunk = files.find((f) => f.includes("code-field") && f.endsWith(".js"));

    expect(codeFieldChunk).toBeDefined();
  }, 120000);

  it("main chunk is under 400 KB gzipped", () => {
    const statsPath = resolve(ROOT, "dist", "stats.json");
    expect(existsSync(statsPath)).toBe(true);

    const stats = JSON.parse(readFileSync(statsPath, "utf-8")) as {
      chunks: Array<{ name: string; gzipSize: number; isEntry: boolean }>;
    };

    // Find the entry chunk(s)
    const entryChunks = stats.chunks.filter((c) => c.isEntry);
    expect(entryChunks.length).toBeGreaterThan(0);

    const BUDGET_BYTES = 400 * 1024; // 400 KB
    for (const chunk of entryChunks) {
      expect(chunk.gzipSize).toBeLessThan(BUDGET_BYTES);
    }
  });

  it("code-field chunk is separate from entry chunks", () => {
    const statsPath = resolve(ROOT, "dist", "stats.json");
    const stats = JSON.parse(readFileSync(statsPath, "utf-8")) as {
      chunks: Array<{ name: string; isEntry: boolean }>;
    };

    const codeFieldChunk = stats.chunks.find((c) => c.name.includes("code-field"));
    expect(codeFieldChunk).toBeDefined();
    expect(codeFieldChunk?.isEntry).toBe(false);
  });
});
