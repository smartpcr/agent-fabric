import { useEffect, useCallback } from "react";
import { useForm, Controller, type ControllerRenderProps, type Control } from "react-hook-form";
import type { z } from "zod";
import { introspect, type FieldDescriptor } from "@/features/property-grid/introspect";

export type { FieldDescriptor } from "@/features/property-grid/introspect";
export { introspect as introspectSchema } from "@/features/property-grid/introspect";

/** Props passed to every field component resolved from the registry. */
export interface FieldComponentProps {
  readonly descriptor: FieldDescriptor;
  readonly field: ControllerRenderProps;
}

/** A React component that renders a form field for a given descriptor. */
export type FieldComponent = React.ComponentType<FieldComponentProps>;

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
  const fields = introspect(schema);
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
