import { describe, it, expect, beforeAll, afterAll } from "vitest";
import i18n from "i18next";
import { initI18n } from "@/i18n/index";

describe("i18n initialisation", () => {
  beforeAll(() => {
    // Reset i18next so each test run starts clean
    if (i18n.isInitialized) {
      // Can't truly uninitialise i18next, but we can re-use the instance
    } else {
      initI18n();
    }
  });

  afterAll(() => {
    // No teardown needed — i18next is a singleton for the process
  });

  // ── Basic wiring ──────────────────────────────────────────────────

  it("initialises i18next", () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it("sets English as the default language", () => {
    expect(i18n.language).toBe("en");
  });

  it("sets English as the fallback language", () => {
    const fb = i18n.options.fallbackLng;
    // fallbackLng can be string | string[] | object — normalise
    if (Array.isArray(fb)) {
      expect(fb).toContain("en");
    } else {
      expect(fb).toBe("en");
    }
  });

  // ── Key resolution ────────────────────────────────────────────────

  it("t() returns the correct string for a known key", () => {
    const result = i18n.t("app.title");
    expect(result).toBe("Workflow Editor");
  });

  it("t() falls back to the key itself for an unknown key", () => {
    const result = i18n.t("some.missing.key");
    expect(result).toBe("some.missing.key");
  });

  it("returns the key for a deeply nested unknown key", () => {
    const result = i18n.t("a.b.c.d.e");
    expect(result).toBe("a.b.c.d.e");
  });

  // ── Idempotent init ───────────────────────────────────────────────

  it("initI18n() is idempotent — calling twice returns the same instance", () => {
    const first = initI18n();
    const second = initI18n();
    expect(first).toBe(second);
  });

  // ── Resources loaded ──────────────────────────────────────────────

  it("has English translation resources loaded", () => {
    const bundle = i18n.getResourceBundle("en", "translation") as Record<string, unknown>;
    expect(bundle).toBeDefined();
    expect(bundle).toHaveProperty("app");
    expect(bundle.app).toHaveProperty("title", "Workflow Editor");
  });
});
