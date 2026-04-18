import * as Switch from "@radix-ui/react-switch";
import type { FieldComponentProps } from "@/features/property-grid/registry";

/**
 * Boolean field using Radix Switch.
 *
 * - `aria-label` from schema description (falls back to descriptor name)
 * - `aria-describedby` linking to error message when present
 * - Toggle via click or Space key (built into Radix Switch)
 */
export function BooleanField({ descriptor, field, error }: FieldComponentProps) {
  const errorId = `error-${descriptor.name}`;
  const checked = Boolean(field.value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      field.onChange(!checked);
    }
  };

  return (
    <>
      <Switch.Root
        id={`field-${descriptor.name}`}
        checked={checked}
        onCheckedChange={(value: boolean) => {
          field.onChange(value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={field.onBlur}
        name={field.name}
        aria-label={descriptor.description ?? descriptor.name}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        data-testid={`field-${descriptor.name}`}
      >
        <Switch.Thumb data-testid={`thumb-${descriptor.name}`} />
      </Switch.Root>
      {error && (
        <span id={errorId} role="alert" data-testid={`error-${descriptor.name}`}>
          {error}
        </span>
      )}
    </>
  );
}
