import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "../../..");

/**
 * Run ESLint on a temporary file and return the exit code + output.
 * Uses the project .eslintrc.cjs which includes the jsx-no-literals rule.
 * Each call uses a unique temp directory to avoid parallel-test collisions.
 */
function lintString(code: string): { exitCode: number; stdout: string } {
  const id = randomBytes(6).toString("hex");
  const tmpDir = join(ROOT, "tests", "unit", "i18n", `__lint_${id}__`);
  mkdirSync(tmpDir, { recursive: true });
  const filepath = join(tmpDir, "TestComponent.tsx");
  writeFileSync(filepath, code, "utf-8");

  try {
    const stdout = execSync(
      `npx eslint --no-ignore --no-cache "${filepath.replace(/\\/g, "/")}"`,
      { cwd: ROOT, encoding: "utf-8", timeout: 25000 },
    );
    return { exitCode: 0, stdout };
  } catch (err: unknown) {
    const error = err as { status?: number; stdout?: string };
    return {
      exitCode: error.status ?? 1,
      stdout: error.stdout ?? "",
    };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("i18n ESLint rule — react/jsx-no-literals + i18n-json/no-raw-text", () => {
  it("fails lint on a hard-coded string in a JSX text node", () => {
    const code = `export function Bad() {
  return <p>Hard-coded text</p>;
}
`;
    const result = lintString(code);
    // The rules are set to "error" so ESLint must exit with non-zero code
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain("jsx-no-literals");
  }, 30000);

  it("passes when using t() from react-i18next", () => {
    const code = `import { useTranslation } from "react-i18next";

export function Good() {
  const { t } = useTranslation();
  return <p>{t("some.key")}</p>;
}
`;
    const result = lintString(code);
    expect(result.stdout).not.toContain("jsx-no-literals");
    expect(result.stdout).not.toContain("no-raw-text");
    expect(result.exitCode).toBe(0);
  }, 30000);

  it("reports the custom i18n-json/no-raw-text rule for raw text", () => {
    const code = `export function Bad() {
  return <p>Untranslated text</p>;
}
`;
    const result = lintString(code);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toContain("no-raw-text");
  }, 30000);
});
