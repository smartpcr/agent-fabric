import * as Select from "@radix-ui/react-select";
import type { FieldComponentProps } from "@/features/property-grid/registry";

/**
 * Enum field using Radix Select.
 *
 * - Options sourced from `descriptor.enumValues`
 * - Default value from schema
 * - `aria-label` from descriptor description (falls back to name)
 * - Keyboard navigation delegated to Radix Select (arrows, Enter)
 */
export function EnumField({ descriptor, field, error }: FieldComponentProps) {
  const errorId = `error-${descriptor.name}`;
  const options = descriptor.enumValues ?? [];

  // Use field.value if present, otherwise fall back to schema default
  const rawValue: unknown =
    field.value !== null && field.value !== undefined
      ? (field.value as unknown)
      : descriptor.defaultValue;
  // Enum values are always strings — cast safely after null check
  const currentValue =
    rawValue !== null && rawValue !== undefined ? (rawValue as string) : undefined;

  return (
    <>
      <Select.Root
        value={currentValue}
        onValueChange={(value: string) => {
          field.onChange(value);
        }}
        name={field.name}
      >
        <Select.Trigger
          id={`field-${descriptor.name}`}
          aria-label={descriptor.description ?? descriptor.name}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          data-testid={`field-${descriptor.name}`}
          onBlur={field.onBlur}
        >
          <Select.Value placeholder={descriptor.description ?? "Select..."} />
          <Select.Icon data-testid={`icon-${descriptor.name}`} />
        </Select.Trigger>

        <Select.Portal>
          <Select.Content data-testid={`content-${descriptor.name}`} position="popper">
            <Select.Viewport data-testid={`viewport-${descriptor.name}`}>
              {options.map((option) => (
                <Select.Item
                  key={option}
                  value={option}
                  data-testid={`option-${descriptor.name}-${option}`}
                >
                  <Select.ItemText>{option}</Select.ItemText>
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {error && (
        <span id={errorId} role="alert" data-testid={`error-${descriptor.name}`}>
          {error}
        </span>
      )}
    </>
  );
}
