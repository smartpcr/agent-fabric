import { useState, useCallback } from "react";
import type { FieldComponentProps } from "@/features/property-grid/registry";

/** Sentinel value used to replace raw secrets in autosave payloads. */
export const SECRET_SENTINEL = "<secret>";

// ─── Extended props ──────────────────────────────────────────────────

export interface SecretFieldProps extends FieldComponentProps {
  /** Callback fired after a clipboard copy attempt (success or failure). */
  readonly onCopyToast?: (opts: { title: string; variant?: string }) => void;
}

/**
 * Masked secret field with reveal toggle and clipboard copy.
 *
 * - Renders `<input type="password">` by default
 * - Reveal button toggles between `type="password"` and `type="text"`
 * - Copy button writes the value to the clipboard and fires a toast callback
 * - Autosave integration: use `scrubSecrets()` to replace raw values with the
 *   `SECRET_SENTINEL` before persisting.
 */
export function SecretField({ descriptor, field, error, onCopyToast }: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);

  const errorId = `error-${descriptor.name}`;
  const displayValue = field.value !== null && field.value !== undefined ? String(field.value) : "";

  const toggleReveal = useCallback(() => {
    setRevealed((prev) => !prev);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayValue);
      onCopyToast?.({ title: "Copied to clipboard", variant: "success" });
    } catch {
      onCopyToast?.({ title: "Failed to copy", variant: "error" });
    }
  }, [displayValue, onCopyToast]);

  return (
    <div data-testid={`secret-field-${descriptor.name}`}>
      <input
        type={revealed ? "text" : "password"}
        id={`field-${descriptor.name}`}
        value={displayValue}
        onChange={(e) => {
          field.onChange(e.target.value);
        }}
        onBlur={field.onBlur}
        name={field.name}
        aria-label={descriptor.name}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        data-testid={`field-${descriptor.name}`}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={toggleReveal}
        aria-label={revealed ? "Hide secret" : "Reveal secret"}
        data-testid={`reveal-${descriptor.name}`}
      >
        {revealed ? "Hide" : "Reveal"}
      </button>
      <button
        type="button"
        onClick={() => {
          void handleCopy();
        }}
        aria-label="Copy to clipboard"
        data-testid={`copy-${descriptor.name}`}
      >
        Copy
      </button>
      {error && (
        <span id={errorId} role="alert" data-testid={`error-${descriptor.name}`}>
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Autosave scrubbing ──────────────────────────────────────────────

/**
 * List of field names that are considered secret.
 * Used by `scrubSecrets` to replace their raw values in autosave payloads.
 */
export const SECRET_FIELD_NAMES = new Set<string>();

/** Register a field name as a secret for autosave scrubbing. */
export function registerSecretField(name: string): void {
  SECRET_FIELD_NAMES.add(name);
}

/**
 * Recursively scrub secret field values from a data payload.
 *
 * Replaces the value of any key in `SECRET_FIELD_NAMES` with `SECRET_SENTINEL`.
 * Returns a new object — does not mutate the input.
 */
export function scrubSecrets(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => scrubSecrets(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SECRET_FIELD_NAMES.has(key)) {
      result[key] = SECRET_SENTINEL;
    } else if (typeof value === "object" && value !== null) {
      result[key] = scrubSecrets(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
