/* eslint-disable max-classes-per-file */

export class DomainError extends Error {
  readonly code: string;

  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class ConnectionInvalidError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, details);
    this.name = "ConnectionInvalidError";
  }
}

export class GraphValidationError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, details);
    this.name = "GraphValidationError";
  }
}

export class SerializationError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, details);
    this.name = "SerializationError";
  }
}

export class MigrationError extends DomainError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, message, details);
    this.name = "MigrationError";
  }
}
