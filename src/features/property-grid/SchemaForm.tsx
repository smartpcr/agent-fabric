import { useEffect, useCallback } from "react";
import { useForm, Controller, type Control, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { introspect, type FieldDescriptor } from "@/features/property-grid/introspect";
import {
  FieldRegistry,
  type FieldComponentProps,
  type FieldResolver,
} from "@/features/property-grid/registry";

export type { FieldDescriptor } from "@/features/property-grid/introspect";
export { introspect as introspectSchema } from "@/features/property-grid/introspect";
export {
  FieldRegistry,
  type FieldComponentProps,
  type FieldComponent,
  type FieldResolver,
} from "@/features/property-grid/registry";

// ─── Built-in field components ───────────────────────────────────────

function StringField({ descriptor, field, error }: FieldComponentProps) {
  return (
    <>
      <input
        type="text"
        value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
        onChange={(e) => {
          field.onChange(e.target.value);
        }}
        onBlur={field.onBlur}
        name={field.name}
        aria-label={descriptor.name}
        aria-invalid={!!error}
        data-testid={`field-${descriptor.name}`}
      />
      {error && (
        <span role="alert" data-testid={`error-${descriptor.name}`}>
          {error}
        </span>
      )}
    </>
  );
}

function NumberField({ descriptor, field, error }: FieldComponentProps) {
  return (
    <>
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
        aria-invalid={!!error}
        data-testid={`field-${descriptor.name}`}
      />
      {error && (
        <span role="alert" data-testid={`error-${descriptor.name}`}>
          {error}
        </span>
      )}
    </>
  );
}

function BooleanField({ descriptor, field, error }: FieldComponentProps) {
  return (
    <>
      <input
        type="checkbox"
        checked={Boolean(field.value)}
        onChange={(e) => {
          field.onChange(e.target.checked);
        }}
        onBlur={field.onBlur}
        name={field.name}
        aria-label={descriptor.name}
        aria-invalid={!!error}
        data-testid={`field-${descriptor.name}`}
      />
      {error && (
        <span role="alert" data-testid={`error-${descriptor.name}`}>
          {error}
        </span>
      )}
    </>
  );
}

function EnumField({ descriptor, field, error }: FieldComponentProps) {
  return (
    <>
      <select
        value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
        onChange={(e) => {
          field.onChange(e.target.value);
        }}
        onBlur={field.onBlur}
        name={field.name}
        aria-label={descriptor.name}
        aria-invalid={!!error}
        data-testid={`field-${descriptor.name}`}
      >
        {descriptor.enumValues?.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" data-testid={`error-${descriptor.name}`}>
          {error}
        </span>
      )}
    </>
  );
}

// ─── Default field registry ──────────────────────────────────────────

/** Pre-built registry mapping built-in types to their components.
 *  Falls back to StringField for any unrecognised type. */
export const defaultFieldRegistry = new FieldRegistry(StringField);
defaultFieldRegistry.registerField("string", StringField);
defaultFieldRegistry.registerField("number", NumberField);
defaultFieldRegistry.registerField("boolean", BooleanField);
defaultFieldRegistry.registerField("enum", EnumField);

// ─── Recursive field tree renderer ───────────────────────────────────

interface FieldTreeProps {
  readonly descriptors: readonly FieldDescriptor[];
  readonly control: Control;
  readonly registry: FieldResolver;
  readonly errors: FieldErrors;
  readonly prefix?: string;
}

/**
 * Extract the error message string for a given field path from react-hook-form errors.
 * Supports dot-path traversal (e.g. "address.city").
 */
function getFieldError(errors: FieldErrors, fieldPath: string): string | undefined {
  const parts = fieldPath.split(".");
  let current: unknown = errors;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  if (
    current !== null &&
    current !== undefined &&
    typeof current === "object" &&
    "message" in current
  ) {
    return (current as { message?: string }).message;
  }
  return undefined;
}

/** Renders a tree of fields, recursing into nested object descriptors. */
function FieldTree({ descriptors, control, registry, errors, prefix = "" }: FieldTreeProps) {
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
                errors={errors}
                prefix={fieldPath}
              />
            </fieldset>
          );
        }

        const Component = registry.resolveField(descriptor);
        const errorMessage = getFieldError(errors, fieldPath);
        return (
          <div key={descriptor.name} data-testid={`field-wrapper-${descriptor.name}`}>
            <label htmlFor={`field-${descriptor.name}`}>{descriptor.name}</label>
            <Controller
              name={fieldPath}
              control={control}
              render={({ field }) => (
                <Component descriptor={descriptor} field={field} error={errorMessage} />
              )}
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
  /** Optional field resolver/registry; defaults to built-in type-based registry. */
  readonly fieldRegistry?: FieldResolver;
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
  const fields = introspect(schema);
  const registry = fieldRegistry ?? defaultFieldRegistry;

  const {
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: value,
    resolver: zodResolver(schema),
    mode: "onChange",
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
      <FieldTree descriptors={fields} control={control} registry={registry} errors={errors} />
    </form>
  );
}
