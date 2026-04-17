import { describe, it, expect } from "vitest";
import { isAssignable, type DataTypeWhitelist } from "@/domain/validation/dataTypes";

describe("isAssignable", () => {
  describe("any type", () => {
    it("target 'any' accepts any source", () => {
      expect(isAssignable("string", "any")).toBe(true);
      expect(isAssignable("number", "any")).toBe(true);
      expect(isAssignable("custom", "any")).toBe(true);
    });

    it("source 'any' assigns to any target", () => {
      expect(isAssignable("any", "string")).toBe(true);
      expect(isAssignable("any", "number")).toBe(true);
      expect(isAssignable("any", "custom")).toBe(true);
    });

    it("any to any is assignable", () => {
      expect(isAssignable("any", "any")).toBe(true);
    });
  });

  describe("equality", () => {
    it("same types are assignable", () => {
      expect(isAssignable("string", "string")).toBe(true);
      expect(isAssignable("number", "number")).toBe(true);
      expect(isAssignable("json", "json")).toBe(true);
    });

    it("different types are not assignable without whitelist", () => {
      expect(isAssignable("string", "number")).toBe(false);
      expect(isAssignable("number", "boolean")).toBe(false);
    });
  });

  describe("whitelist coercion", () => {
    const whitelist: DataTypeWhitelist = {
      json: ["string", "number"],
      number: ["string"],
    };

    it("allows coercion from whitelist source to listed target", () => {
      expect(isAssignable("json", "string", whitelist)).toBe(true);
      expect(isAssignable("json", "number", whitelist)).toBe(true);
      expect(isAssignable("number", "string", whitelist)).toBe(true);
    });

    it("rejects coercion not in whitelist", () => {
      expect(isAssignable("json", "boolean", whitelist)).toBe(false);
      expect(isAssignable("string", "number", whitelist)).toBe(false);
    });

    it("still applies any rules with whitelist", () => {
      expect(isAssignable("any", "number", whitelist)).toBe(true);
      expect(isAssignable("string", "any", whitelist)).toBe(true);
    });

    it("still applies equality with whitelist", () => {
      expect(isAssignable("boolean", "boolean", whitelist)).toBe(true);
    });
  });

  describe("strict mismatch", () => {
    it("rejects mismatched types without any or whitelist", () => {
      expect(isAssignable("string", "number")).toBe(false);
      expect(isAssignable("boolean", "object")).toBe(false);
      expect(isAssignable("custom-a", "custom-b")).toBe(false);
    });
  });
});
