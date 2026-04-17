import { describe, it, expect } from "vitest";
import {
  getPortColorVariable,
  getPortColorLegend,
  getKnownDataTypes,
} from "@/features/nodes/ports/handleStyles";

describe("getPortColorVariable", () => {
  it("maps 'string' to --color-port-string", () => {
    expect(getPortColorVariable("string")).toBe("--color-port-string");
  });

  it("maps 'json' to --color-port-json", () => {
    expect(getPortColorVariable("json")).toBe("--color-port-json");
  });

  it("maps 'number' to --color-port-number", () => {
    expect(getPortColorVariable("number")).toBe("--color-port-number");
  });

  it("maps 'boolean' to --color-port-boolean", () => {
    expect(getPortColorVariable("boolean")).toBe("--color-port-boolean");
  });

  it("maps 'any' to --color-port-any", () => {
    expect(getPortColorVariable("any")).toBe("--color-port-any");
  });

  it("falls back to --color-port-neutral for unknown types", () => {
    expect(getPortColorVariable("unknown-type")).toBe("--color-port-neutral");
  });

  it("falls back to --color-port-neutral for empty string", () => {
    expect(getPortColorVariable("")).toBe("--color-port-neutral");
  });

  it("is case-sensitive (uppercase String falls back)", () => {
    expect(getPortColorVariable("String")).toBe("--color-port-neutral");
  });
});

describe("getPortColorLegend", () => {
  it("returns an array of all known mappings", () => {
    const legend = getPortColorLegend();
    expect(legend.length).toBeGreaterThanOrEqual(5);
  });

  it("each entry has dataType, cssVariable, and label", () => {
    const legend = getPortColorLegend();
    for (const entry of legend) {
      expect(entry.dataType).toBeTruthy();
      expect(entry.cssVariable).toMatch(/^--color-port-/);
      expect(entry.label).toBeTruthy();
    }
  });

  it("label is capitalized version of dataType", () => {
    const legend = getPortColorLegend();
    for (const entry of legend) {
      const expected = entry.dataType.charAt(0).toUpperCase() + entry.dataType.slice(1);
      expect(entry.label).toBe(expected);
    }
  });

  it("includes string mapping", () => {
    const legend = getPortColorLegend();
    const stringEntry = legend.find((e) => e.dataType === "string");
    expect(stringEntry).toBeDefined();
    expect(stringEntry?.cssVariable).toBe("--color-port-string");
    expect(stringEntry?.label).toBe("String");
  });

  it("includes json mapping", () => {
    const legend = getPortColorLegend();
    const jsonEntry = legend.find((e) => e.dataType === "json");
    expect(jsonEntry).toBeDefined();
    expect(jsonEntry?.cssVariable).toBe("--color-port-json");
  });
});

describe("getKnownDataTypes", () => {
  it("returns all known data types", () => {
    const types = getKnownDataTypes();
    expect(types).toContain("string");
    expect(types).toContain("json");
    expect(types).toContain("number");
    expect(types).toContain("boolean");
    expect(types).toContain("any");
  });

  it("does not include unknown types", () => {
    const types = getKnownDataTypes();
    expect(types).not.toContain("unknown");
    expect(types).not.toContain("neutral");
  });
});
