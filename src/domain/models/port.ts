export type PortKind = "in" | "out";

export type PortCardinality = "single" | "multi";

export interface PortSpec {
  readonly id: string;
  readonly kind: PortKind;
  readonly label: string;
  readonly dataType: string;
  readonly cardinality: PortCardinality;
  readonly required?: boolean;
}

interface MakePortOptions {
  id: string;
  label: string;
  dataType?: string;
  cardinality?: PortCardinality;
  required?: boolean;
}

function validatePortArgs(id: string, label: string): void {
  if (!id || id.trim().length === 0) {
    throw new Error("PortSpec id must be a non-empty string");
  }
  if (!label || label.trim().length === 0) {
    throw new Error("PortSpec label must be a non-empty string");
  }
}

function buildPortBase(kind: "in" | "out", options: MakePortOptions): PortSpec {
  validatePortArgs(options.id, options.label);
  const base: PortSpec = {
    id: options.id,
    kind,
    label: options.label,
    dataType: options.dataType ?? "any",
    cardinality: options.cardinality ?? "single",
  };
  if (options.required === undefined) {
    return Object.freeze(base);
  }
  return Object.freeze({ ...base, required: options.required });
}

export function makeInputPort(options: MakePortOptions): PortSpec {
  return buildPortBase("in", options);
}

export function makeOutputPort(options: MakePortOptions): PortSpec {
  return buildPortBase("out", options);
}
