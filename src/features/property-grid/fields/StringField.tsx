import type { FieldComponentProps } from "@/features/property-grid/registry";

/**
 * Single-line string field.
 *
 * Renders `<input type="text">` with:
 * - `aria-describedby` pointing to error message when present
 * - `placeholder` from the schema description
 * - `aria-invalid` when validation error exists
 */
export function StringField({ descriptor, field, error }: FieldComponentProps) {
  const errorId = `error-${descriptor.name}`;

  return (
    <>
      <input
        type="text"
        id={`field-${descriptor.name}`}
        value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
        onChange={(e) => {
          field.onChange(e.target.value);
        }}
        onBlur={field.onBlur}
        name={field.name}
        placeholder={descriptor.description}
        aria-label={descriptor.name}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        data-testid={`field-${descriptor.name}`}
      />
      {error && (
        <span id={errorId} role="alert" data-testid={`error-${descriptor.name}`}>
          {error}
        </span>
      )}
    </>
  );
}
