import { useRef, useEffect } from "react";
import type { FieldComponentProps } from "@/features/property-grid/registry";

/**
 * Number field with min/max/step from schema.
 *
 * Renders `<input type="number">` with:
 * - `min`, `max`, `step` attributes derived from the descriptor
 * - `aria-describedby` pointing to error message when present
 * - Clamps non-numeric input to the previous valid value
 */
export function NumberField({ descriptor, field, error }: FieldComponentProps) {
  const errorId = `error-${descriptor.name}`;
  const lastValidRef = useRef<number | undefined>(
    typeof field.value === "number" ? field.value : undefined,
  );

  // Keep the last-valid ref in sync with externally-set valid values
  useEffect(() => {
    if (typeof field.value === "number") {
      lastValidRef.current = field.value;
    }
  }, [field.value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Empty input — user deliberately cleared the field
    if (raw === "") {
      // If the input was cleared because the browser rejected non-numeric input
      // (type="number" sanitises its value), clamp to previous valid value
      if (e.target.validity.badInput) {
        if (lastValidRef.current !== undefined) {
          field.onChange(lastValidRef.current);
        }
        return;
      }
      field.onChange(undefined);
      return;
    }

    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      // Clamp to previous valid value
      if (lastValidRef.current !== undefined) {
        field.onChange(lastValidRef.current);
      }
      return;
    }

    lastValidRef.current = parsed;
    field.onChange(parsed);
  };

  return (
    <>
      <input
        type="number"
        id={`field-${descriptor.name}`}
        value={field.value !== null && field.value !== undefined ? String(field.value) : ""}
        onChange={handleChange}
        onBlur={field.onBlur}
        name={field.name}
        min={descriptor.min}
        max={descriptor.max}
        step={descriptor.step}
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
