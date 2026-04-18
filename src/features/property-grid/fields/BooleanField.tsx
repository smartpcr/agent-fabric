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

  return (
    <>
      <Switch.Root
        id={`field-${descriptor.name}`}
        checked={Boolean(field.value)}
        onCheckedChange={(checked: boolean) => {
          field.onChange(checked);
        }}
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
