import { useEffect, useCallback } from "react";
import { useForm, Controller, type ControllerRenderProps } from "react-hook-form";
import type { z } from "zod";

/** Descriptor for a single field extracted from a Zod schema. */
export interface FieldDescriptor {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "enum" | "object" | "array" | "unknown";
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly enumValues?: readonly string[];
}

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

/** Introspect a Zod object schema into a list of field descriptors. */
export function introspectSchema(schema: z.ZodType): FieldDescriptor[] {
  const def = (schema as unknown as { _zod?: { def?: Record<string, unknown> } })._zod?.def;
  if (!def || def.type !== "object") return [];

  const shape = def.shape as Record<string, z.ZodType> | undefined;
  if (!shape) return [];

  const fields: FieldDescriptor[] = [];
  for (const [name, fieldSchema] of Object.entries(shape)) {
    const unwrapped = unwrapZodType(fieldSchema);

    let type: FieldDescriptor["type"] = "unknown";
    switch (unwrapped.type) {
      case "string":
        type = "string";
        break;
      case "number":
        type = "number";
        break;
      case "boolean":
        type = "boolean";
        break;
      case "enum":
        type = "enum";
        break;
      case "object":
        type = "object";
        break;
      case "array":
        type = "array";
        break;
      default:
        type = "unknown";
        break;
    }

    const innerDef = (unwrapped.inner as unknown as { _zod?: { def?: Record<string, unknown> } })
      ._zod?.def;
    const enumEntries = innerDef?.entries as Record<string, string> | undefined;

    fields.push({
      name,
      type,
      required: unwrapped.required,
      defaultValue: unwrapped.defaultValue,
      enumValues: type === "enum" && enumEntries ? Object.values(enumEntries) : undefined,
    });
  }

  return fields;
}

/** Render a single field based on its descriptor. */
function renderField(
  descriptor: FieldDescriptor,
  field: ControllerRenderProps,
): React.ReactElement {
  switch (descriptor.type) {
    case "boolean":
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
    case "number":
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
    case "enum":
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
    default:
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
}

export interface SchemaFormProps {
  readonly schema: z.ZodType;
  readonly value: Record<string, unknown>;
  readonly onChange: (value: Record<string, unknown>) => void;
}

/**
 * Schema-driven form component.
 *
 * Introspects a Zod object schema and renders a field for each property.
 * Uses react-hook-form for form state tracking. Calls `onChange` whenever
 * the form values change.
 */
/* eslint-disable react-hooks/incompatible-library -- react-hook-form watch API */
export function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  const fields = introspectSchema(schema);

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
      {fields.map((descriptor) => (
        <div key={descriptor.name} data-testid={`field-wrapper-${descriptor.name}`}>
          <label htmlFor={`field-${descriptor.name}`}>{descriptor.name}</label>
          <Controller
            name={descriptor.name}
            control={control}
            render={({ field }) => renderField(descriptor, field)}
          />
        </div>
      ))}
    </form>
  );
}
