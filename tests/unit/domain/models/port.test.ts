import { describe, it, expect } from "vitest";
import { makeInputPort, makeOutputPort, type PortSpec } from "@/domain/models/port";

describe("PortSpec factories", () => {
  describe("makeInputPort", () => {
    it("creates an input port with sensible defaults", () => {
      const port: PortSpec = makeInputPort({ id: "in1", label: "Input" });
      expect(port.id).toBe("in1");
      expect(port.kind).toBe("in");
      expect(port.label).toBe("Input");
      expect(port.dataType).toBe("any");
      expect(port.cardinality).toBe("single");
      expect(port.required).toBeUndefined();
    });

    it("applies custom dataType and cardinality", () => {
      const port = makeInputPort({
        id: "in2",
        label: "Data In",
        dataType: "string",
        cardinality: "multi",
        required: true,
      });
      expect(port.dataType).toBe("string");
      expect(port.cardinality).toBe("multi");
      expect(port.required).toBe(true);
    });

    it("throws when id is empty", () => {
      expect(() => makeInputPort({ id: "", label: "X" })).toThrow("non-empty string");
    });

    it("throws when id is whitespace-only", () => {
      expect(() => makeInputPort({ id: "  ", label: "X" })).toThrow("non-empty string");
    });

    it("throws when label is empty", () => {
      expect(() => makeInputPort({ id: "x", label: "" })).toThrow("non-empty string");
    });

    it("throws when label is whitespace-only", () => {
      expect(() => makeInputPort({ id: "x", label: "   " })).toThrow("non-empty string");
    });

    it("returns a frozen object", () => {
      const port = makeInputPort({ id: "in1", label: "Input" });
      expect(Object.isFrozen(port)).toBe(true);
    });
  });

  describe("makeOutputPort", () => {
    it("creates an output port with sensible defaults", () => {
      const port: PortSpec = makeOutputPort({ id: "out1", label: "Output" });
      expect(port.id).toBe("out1");
      expect(port.kind).toBe("out");
      expect(port.label).toBe("Output");
      expect(port.dataType).toBe("any");
      expect(port.cardinality).toBe("single");
      expect(port.required).toBeUndefined();
    });

    it("applies custom dataType and cardinality", () => {
      const port = makeOutputPort({
        id: "out2",
        label: "Data Out",
        dataType: "number",
        cardinality: "multi",
        required: false,
      });
      expect(port.dataType).toBe("number");
      expect(port.cardinality).toBe("multi");
      expect(port.required).toBe(false);
    });

    it("throws when id is empty", () => {
      expect(() => makeOutputPort({ id: "", label: "X" })).toThrow("non-empty string");
    });

    it("throws when label is empty", () => {
      expect(() => makeOutputPort({ id: "x", label: "" })).toThrow("non-empty string");
    });

    it("returns a frozen object", () => {
      const port = makeOutputPort({ id: "out1", label: "Output" });
      expect(Object.isFrozen(port)).toBe(true);
    });
  });
});
