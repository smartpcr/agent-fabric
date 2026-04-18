import type { z } from "zod";

/**
 * Descriptor for a single field extracted from a Zod schema.
 *
 * The `type` discriminator drives which field component the registry
 * resolves. Nested `object` schemas produce `children`; `array` schemas
 * produce an `elementType`; `record` schemas produce a `valueType`.
 */
export interface FieldDescriptor {
  readonly name: string;
  readonly type:
    | "string"
    | "number"
    | "boolean"
    | "enum"
    | "object"
    | "array"
    | "record"
    | "unknown";
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly enumValues?: readonly string[];
  /** Schema description (from `.describe()`), used for placeholders/hints. */
  readonly description?: string;
  /** Child descriptors for nested object fields. */
  readonly children?: readonly FieldDescriptor[];
  /** Descriptor for array element type. */
  readonly elementType?: FieldDescriptor;
  /** Descriptor for record value type. */
  readonly valueType?: FieldDescriptor;
}

// ─── Internal helpers ────────────────────────────────────────────────

interface ZodDef {
  readonly type?: string;
  readonly innerType?: unknown;
  readonly defaultValue?: unknown;
  readonly shape?: Record<string, unknown>;
  readonly entries?: Record<string, string>;
  readonly element?: unknown;
  readonly keyType?: unknown;
  readonly valueType?: unknown;
}

function getZodDef(schema: unknown): ZodDef | undefined {
  const typed = schema as { _zod?: { def?: ZodDef } } | null | undefined;
  return typed?._zod?.def;
}

interface UnwrapResult {
  type: string;
  inner: z.ZodType;
  required: boolean;
  defaultValue?: unknown;
}

/** Extract the underlying Zod type, unwrapping optional/default wrappers. */
function unwrapZodType(schema: z.ZodType): UnwrapResult {
  const def = getZodDef(schema);
  if (!def) return { type: "unknown", inner: schema, required: true };

  const zodType = def.type;

  if (zodType === "optional") {
    const inner = def.innerType as z.ZodType;
    const result = unwrapZodType(inner);
    return { ...result, required: false };
  }

  if (zodType === "default") {
    const inner = def.innerType as z.ZodType;
    const result = unwrapZodType(inner);
    return { ...result, required: false, defaultValue: def.defaultValue };
  }

  return { type: zodType ?? "unknown", inner: schema, required: true };
}

const ZOD_TYPE_MAP: Record<string, FieldDescriptor["type"]> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  enum: "enum",
  object: "object",
  array: "array",
  record: "record",
};

/**
 * Introspect a single Zod type into a partial FieldDescriptor (without name).
 * Used to describe array element types and record value types.
 */
function introspectType(schema: z.ZodType): Omit<FieldDescriptor, "name"> {
  const unwrapped = unwrapZodType(schema);
  const type: FieldDescriptor["type"] = ZOD_TYPE_MAP[unwrapped.type] ?? "unknown";

  const innerDef = getZodDef(unwrapped.inner);
  const enumEntries = innerDef?.entries;

  const children = type === "object" ? introspect(unwrapped.inner) : undefined;

  const elementType =
    type === "array" && innerDef?.element
      ? { name: "element", ...introspectType(innerDef.element as z.ZodType) }
      : undefined;

  const valueType =
    type === "record" && innerDef?.valueType
      ? { name: "value", ...introspectType(innerDef.valueType as z.ZodType) }
      : undefined;

  // Extract description from Zod's .describe() — stored on the schema object itself
  const description =
    typeof (schema as { description?: unknown }).description === "string"
      ? (schema as { description: string }).description
      : undefined;

  return {
    type,
    required: unwrapped.required,
    defaultValue: unwrapped.defaultValue,
    description,
    enumValues: type === "enum" && enumEntries ? Object.values(enumEntries) : undefined,
    children: children && children.length > 0 ? children : undefined,
    elementType,
    valueType,
  };
}

/**
 * Introspect a Zod object schema into a list of field descriptors.
 *
 * Handles: `ZodString`, `ZodNumber`, `ZodBoolean`, `ZodEnum`,
 * `ZodObject` (recursive), `ZodArray`, `ZodRecord`, `ZodOptional`,
 * `ZodDefault`.
 *
 * Non-object schemas return an empty array.
 */
export function introspect(schema: z.ZodType): FieldDescriptor[] {
  const def = getZodDef(schema);
  if (!def || def.type !== "object") return [];

  const shape = def.shape as Record<string, z.ZodType> | undefined;
  if (!shape) return [];

  const fields: FieldDescriptor[] = [];
  for (const [name, fieldSchema] of Object.entries(shape)) {
    fields.push({ name, ...introspectType(fieldSchema) });
  }

  return fields;
}
