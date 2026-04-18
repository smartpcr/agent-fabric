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
  /** Minimum value for number fields (from Zod `.min()`). */
  readonly min?: number;
  /** Maximum value for number fields (from Zod `.max()`). */
  readonly max?: number;
  /** Step value for number fields (from Zod `.step()` / `.multipleOf()`). */
  readonly step?: number;
  /** Child descriptors for nested object fields. */
  readonly children?: readonly FieldDescriptor[];
  /** Descriptor for array element type. */
  readonly elementType?: FieldDescriptor;
  /** Descriptor for record value type. */
  readonly valueType?: FieldDescriptor;
  /** When true, this field contains a secret and should be scrubbed before persistence. */
  readonly secret?: boolean;
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

interface ZodBag {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly multipleOf?: number;
}

function getZodBag(schema: unknown): ZodBag | undefined {
  const typed = schema as { _zod?: { bag?: ZodBag } } | null | undefined;
  return typed?._zod?.bag;
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

/** Extract description from Zod's .describe() */
function extractDescription(schema: z.ZodType): string | undefined {
  const desc = (schema as { description?: unknown }).description;
  return typeof desc === "string" ? desc : undefined;
}

/**
 * Detect whether a field is marked as secret via its description metadata.
 *
 * Supports two conventions:
 * - JSON-parseable description containing `{ "secret": true }` (or single-quote variant)
 * - Plain description string equal to `"secret"` (case-insensitive)
 */
function extractSecret(description?: string): boolean {
  if (!description) return false;
  if (description.trim().toLowerCase() === "secret") return true;
  try {
    const normalized = description.replace(/'/g, '"').replace(/(\w+)\s*:/g, '"$1":');
    const parsed: unknown = JSON.parse(normalized);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "secret" in parsed &&
      (parsed as Record<string, unknown>).secret === true
    ) {
      return true;
    }
  } catch {
    // Not JSON — ignore
  }
  return false;
}

/** Extract numeric constraints from Zod's bag */
function extractNumericConstraints(
  type: FieldDescriptor["type"],
  inner: z.ZodType,
): Pick<FieldDescriptor, "min" | "max" | "step"> {
  if (type !== "number") return {};
  const bag = getZodBag(inner);
  if (!bag) return {};
  return {
    min: bag.minimum,
    max: bag.maximum,
    step: bag.multipleOf,
  };
}

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

  // Check description on both the outer schema and the unwrapped inner
  // (description may be on the inner type when .describe() is called before .optional()/.default())
  const description = extractDescription(schema) ?? extractDescription(unwrapped.inner);
  const secret = extractSecret(description) || undefined;

  return {
    type,
    required: unwrapped.required,
    defaultValue: unwrapped.defaultValue,
    description,
    ...extractNumericConstraints(type, unwrapped.inner),
    enumValues: type === "enum" && enumEntries ? Object.values(enumEntries) : undefined,
    children: children && children.length > 0 ? children : undefined,
    elementType,
    valueType,
    secret,
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
