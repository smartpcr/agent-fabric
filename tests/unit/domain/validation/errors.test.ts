import { describe, it, expect } from "vitest";
import {
  DomainError,
  ConnectionInvalidError,
  GraphValidationError,
  SerializationError,
  MigrationError,
} from "@/domain/validation/errors";

describe("DomainError hierarchy", () => {
  // instanceof chains
  it("DomainError is an instance of Error", () => {
    const err = new DomainError("GENERIC", "something failed");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
  });

  it("ConnectionInvalidError is an instance of DomainError and Error", () => {
    const err = new ConnectionInvalidError("WRONG_DIRECTION", "bad direction");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(ConnectionInvalidError);
  });

  it("GraphValidationError is an instance of DomainError and Error", () => {
    const err = new GraphValidationError("NO_ENTRY_NODE", "missing entry");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(GraphValidationError);
  });

  it("SerializationError is an instance of DomainError and Error", () => {
    const err = new SerializationError("INVALID_JSON", "bad json");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(SerializationError);
  });

  it("MigrationError is an instance of DomainError and Error", () => {
    const err = new MigrationError("VERSION_MISMATCH", "wrong version");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(MigrationError);
  });

  // Subclasses are NOT instances of each other
  it("subclasses are not instances of sibling classes", () => {
    const conn = new ConnectionInvalidError("C", "c");
    const graph = new GraphValidationError("G", "g");
    expect(conn).not.toBeInstanceOf(GraphValidationError);
    expect(graph).not.toBeInstanceOf(ConnectionInvalidError);
    expect(conn).not.toBeInstanceOf(SerializationError);
    expect(conn).not.toBeInstanceOf(MigrationError);
  });

  // code and details
  it("carries code and details", () => {
    const err = new ConnectionInvalidError("DATA_TYPE_MISMATCH", "types differ", {
      sourceType: "number",
      targetType: "string",
    });
    expect(err.code).toBe("DATA_TYPE_MISMATCH");
    expect(err.details).toEqual({ sourceType: "number", targetType: "string" });
  });

  it("defaults details to empty object", () => {
    const err = new DomainError("X", "msg");
    expect(err.details).toEqual({});
  });

  // message formatting
  it("preserves the message property", () => {
    const err = new GraphValidationError("UNREACHABLE_NODE", 'Node "n1" is unreachable');
    expect(err.message).toBe('Node "n1" is unreachable');
  });

  it("sets the name property to the class name", () => {
    expect(new DomainError("X", "x").name).toBe("DomainError");
    expect(new ConnectionInvalidError("X", "x").name).toBe("ConnectionInvalidError");
    expect(new GraphValidationError("X", "x").name).toBe("GraphValidationError");
    expect(new SerializationError("X", "x").name).toBe("SerializationError");
    expect(new MigrationError("X", "x").name).toBe("MigrationError");
  });

  // JSON serializable via custom toJSON
  it("toJSON produces a plain object with name, code, message, details", () => {
    const err = new SerializationError("PARSE_FAILED", "bad input", { line: 42 });
    const json = err.toJSON();
    expect(json).toEqual({
      name: "SerializationError",
      code: "PARSE_FAILED",
      message: "bad input",
      details: { line: 42 },
    });
  });

  // JSON round-trip preserves code + details
  it("JSON round-trip preserves code and details", () => {
    const err = new MigrationError("NO_MIGRATION_PATH", "cannot migrate", {
      from: 1,
      to: 5,
    });
    const serialized = JSON.stringify(err);
    const parsed = JSON.parse(serialized) as ReturnType<typeof err.toJSON>;
    expect(parsed.code).toBe("NO_MIGRATION_PATH");
    expect(parsed.message).toBe("cannot migrate");
    expect(parsed.details).toEqual({ from: 1, to: 5 });
    expect(parsed.name).toBe("MigrationError");
  });

  // JSON.stringify uses toJSON automatically
  it("JSON.stringify invokes toJSON", () => {
    const err = new ConnectionInvalidError("PORT_NOT_FOUND", "port missing", { portId: "in" });
    const raw = JSON.stringify(err);
    const parsed = JSON.parse(raw) as ReturnType<typeof err.toJSON>;
    expect(parsed.code).toBe("PORT_NOT_FOUND");
    expect(parsed.details).toEqual({ portId: "in" });
  });
});
