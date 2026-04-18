import { useEffect, useCallback } from "react";
import { useForm, Controller, type ControllerRenderProps, type Control } from "react-hook-form";
import type { z } from "zod";

/** Descriptor for a single field extracted from a Zod schema. */
export interface FieldDescriptor {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "enum" | "object" | "array" | "unknown";
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly enumValues?: readonly string[];
  /** Child descriptors for nested object fields. */
  readonly children?: readonly FieldDescriptor[];
}

/** Props passed to every field component resolved from the registry. */
export interface FieldComponentProps {
  readonly descriptor: FieldDescriptor;
  readonly field: ControllerRenderProps;
}

/** A React component that renders a form field for a given descriptor. */
export type FieldComponent = React.ComponentType<FieldComponentProps>;

/** Extract the underlying Zod type, unwrapping optional/default wrappers. */
function unwrapZodType(schema: z.ZodType): {
  type: string;
  inner: z.ZodType;
  required: boolean;
  defaultValue?: unknown;
} {
  const def = (schema as unknown as { _zod?: { def?: Record<string, unknown> } })._zod?.def;
  if (!def) return { type: "unknown", inner: schema, required: true };

  const zodType = def.type as string | undefined;

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
};

/** Introspect a Zod object schema into a list of field descriptors (recursive). */
export function introspectSchema(schema: z.ZodType): FieldDescriptor[] {
  const def = (schema as unknown as { _zod?: { def?: Record<string, unknown> } })._zod?.def;
  if (!def || def.type !== "object") return [];

  const shape = def.shape as Record<string, z.ZodType> | undefined;
  if (!shape) return [];

  const fields: FieldDescriptor[] = [];
  for (const [name, fieldSchema] of Object.entries(shape)) {
    const unwrapped = unwrapZodType(fieldSchema);
    const type: FieldDescriptor["type"] = ZOD_TYPE_MAP[unwrapped.type] ?? "unknown";

    const innerDef = (unwrapped.inner as unknown as { _zod?: { def?: Record<string, unknown> } })
      ._zod?.def;
    const enumEntries = innerDef?.entries as Record<string, string> | undefined;

    // Recursively introspect nested object schemas
    const children = type === "object" ? introspectSchema(unwrapped.inner) : undefined;

    fields.push({
      name,
      type,
      required: unwrapped.required,
      defaultValue: unwrapped.defaultValue,
      enumValues: type === "enum" && enumEntries ? Object.values(enumEntries) : undefined,
      children: children && children.length > 0 ? children : undefined,
    });
  }

  return fields;
}

// ─── Built-in field components ───────────────────────────────────────

function StringField({ descriptor, field }: FieldComponentProps) {
  return (
    <input
      type="text"
      value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
      onChange={(e) => {
        field.onChange(e.target.value);
      }}
      onBlur={field.onBlur}
      name={field.name}
      aria-label={descriptor.name}
      data-testid={`field-${descriptor.name}`}
    />
  );
}

function NumberField({ descriptor, field }: FieldComponentProps) {
  return (
    <input
      type="number"
      value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
      onChange={(e) => {
        const val = e.target.value;
        field.onChange(val === "" ? undefined : Number(val));
      }}
      onBlur={field.onBlur}
      name={field.name}
      aria-label={descriptor.name}
      data-testid={`field-${descriptor.name}`}
    />
  );
}

function BooleanField({ descriptor, field }: FieldComponentProps) {
  return (
    <input
      type="checkbox"
      checked={Boolean(field.value)}
      onChange={(e) => {
        field.onChange(e.target.checked);
      }}
      onBlur={field.onBlur}
      name={field.name}
      aria-label={descriptor.name}
      data-testid={`field-${descriptor.name}`}
    />
  );
}

function EnumField({ descriptor, field }: FieldComponentProps) {
  return (
    <select
      value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
      onChange={(e) => {
        field.onChange(e.target.value);
      }}
      onBlur={field.onBlur}
      name={field.name}
      aria-label={descriptor.name}
      data-testid={`field-${descriptor.name}`}
    >
      {descriptor.enumValues?.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}

// ─── Field registry ──────────────────────────────────────────────────

/** Map from field type → React component that renders it. */
export interface FieldRegistry {
  readonly resolve: (descriptor: FieldDescriptor) => FieldComponent;
}

const DEFAULT_FIELD_MAP: Record<string, FieldComponent> = {
  string: StringField,
  number: NumberField,
  boolean: BooleanField,
  enum: EnumField,
};

/** Default field registry that maps type names to built-in components. */
export const defaultFieldRegistry: FieldRegistry = {
  resolve(descriptor: FieldDescriptor): FieldComponent {
    return DEFAULT_FIELD_MAP[descriptor.type] ?? StringField;
  },
};

// ─── Recursive field tree renderer ───────────────────────────────────

interface FieldTreeProps {
  readonly descriptors: readonly FieldDescriptor[];
  readonly control: Control;
  readonly registry: FieldRegistry;
  readonly prefix?: string;
}

/** Renders a tree of fields, recursing into nested object descriptors. */
function FieldTree({ descriptors, control, registry, prefix = "" }: FieldTreeProps) {
  return (
    <>
      {descriptors.map((descriptor) => {
        const fieldPath = prefix ? `${prefix}.${descriptor.name}` : descriptor.name;

        if (descriptor.type === "object" && descriptor.children) {
          return (
            <fieldset
              key={descriptor.name}
              data-testid={`field-wrapper-${descriptor.name}`}
              aria-label={descriptor.name}
            >
              <legend>{descriptor.name}</legend>
              <FieldTree
                descriptors={descriptor.children}
                control={control}
                registry={registry}
                prefix={fieldPath}
              />
            </fieldset>
          );
        }

        const Component = registry.resolve(descriptor);
        return (
          <div key={descriptor.name} data-testid={`field-wrapper-${descriptor.name}`}>
            <label htmlFor={`field-${descriptor.name}`}>{descriptor.name}</label>
            <Controller
              name={fieldPath}
              control={control}
              render={({ field }) => <Component descriptor={descriptor} field={field} />}
            />
          </div>
        );
      })}
    </>
  );
}

// ─── SchemaForm ──────────────────────────────────────────────────────

export interface SchemaFormProps {
  readonly schema: z.ZodType;
  readonly value: Record<string, unknown>;
  readonly onChange: (value: Record<string, unknown>) => void;
  /** Optional field registry; defaults to built-in type-based registry. */
  readonly fieldRegistry?: FieldRegistry;
}

/**
 * Schema-driven form component.
 *
 * Introspects a Zod object schema and renders a tree of fields resolved
 * through a field registry. Uses react-hook-form for form state tracking.
 * Calls `onChange` whenever the form values change.
 */
/* eslint-disable react-hooks/incompatible-library -- react-hook-form watch API */
export function SchemaForm({ schema, value, onChange, fieldRegistry }: SchemaFormProps) {
  const fields = introspectSchema(schema);
  const registry = fieldRegistry ?? defaultFieldRegistry;

  const { control, watch, reset } = useForm({
    defaultValues: value,
  });

  // Reset form when external value changes (e.g., undo/redo)
  useEffect(() => {
    reset(value);
  }, [value, reset]);

  // Stable onChange ref to avoid subscription churn
  const onChangeRef = useCallback(onChange, [onChange]);

  // Watch all fields and propagate changes
  useEffect(() => {
    const subscription = watch((formValues) => {
      onChangeRef(formValues as Record<string, unknown>);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [watch, onChangeRef]);

  return (
    <form
      data-testid="schema-form"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <FieldTree descriptors={fields} control={control} registry={registry} />
    </form>
  );
}
