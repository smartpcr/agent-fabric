import { useState, useCallback, useEffect, useContext } from "react";
import type { FieldComponentProps } from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";
import { ToastContext, type ToastVariant } from "@/features/editor/Toast";

/** Sentinel value used to replace raw secrets in autosave payloads. */
export const SECRET_SENTINEL = "<secret>";

// ─── Autosave scrubbing ──────────────────────────────────────────────

/**
 * Global set of field names considered secret.
 * Populated at mount time by `SecretField` and deterministically by
 * `collectSecretFieldNames` / `registerSecretField`.
 */
export const SECRET_FIELD_NAMES = new Set<string>();

/** Register a field name as a secret for autosave scrubbing. */
export function registerSecretField(name: string): void {
  SECRET_FIELD_NAMES.add(name);
}

/**
 * Walk a tree of field descriptors and collect the names of fields
 * marked with `secret: true`. Recurses into `children`, `elementType`,
 * and `valueType` so nested secrets are discovered deterministically
 * at schema-load time — before any component mounts.
 */
export function collectSecretFieldNames(descriptors: readonly FieldDescriptor[]): string[] {
  const result: string[] = [];
  for (const d of descriptors) {
    if (d.secret) result.push(d.name);
    if (d.children) result.push(...collectSecretFieldNames(d.children));
    if (d.elementType?.children) {
      result.push(...collectSecretFieldNames(d.elementType.children));
    }
    if (d.valueType?.children) {
      result.push(...collectSecretFieldNames(d.valueType.children));
    }
  }
  return result;
}

/**
 * Register secret field names from a tree of descriptors into the global set.
 * Call this at schema-load / registry-setup time so `scrubSecrets` has a
 * complete secret-key set before any component mounts or autosave runs.
 */
export function registerSecretFieldsFromDescriptors(descriptors: readonly FieldDescriptor[]): void {
  for (const name of collectSecretFieldNames(descriptors)) {
    SECRET_FIELD_NAMES.add(name);
  }
}

/**
 * Recursively scrub secret field values from a data payload.
 *
 * Replaces the value of any key in `SECRET_FIELD_NAMES` (or the explicit
 * `secretKeys` set when provided) with `SECRET_SENTINEL`.
 * Returns a new object — does not mutate the input.
 *
 * @param data - The data payload to scrub.
 * @param secretKeys - Optional explicit set of secret key names. When
 *   provided these are merged with `SECRET_FIELD_NAMES` so callers can
 *   supply deterministic keys without relying on the global mutable set.
 */
export function scrubSecrets(data: unknown, secretKeys?: Iterable<string>): unknown {
  const keys = secretKeys ? new Set([...SECRET_FIELD_NAMES, ...secretKeys]) : SECRET_FIELD_NAMES;

  return scrubSecretsInner(data, keys);
}

function scrubSecretsInner(data: unknown, keys: Set<string>): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => scrubSecretsInner(item, keys));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (keys.has(key)) {
      result[key] = SECRET_SENTINEL;
    } else if (typeof value === "object" && value !== null) {
      result[key] = scrubSecretsInner(value, keys);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Extended props ──────────────────────────────────────────────────

export interface SecretFieldProps extends FieldComponentProps {
  /**
   * Optional callback fired after a clipboard copy attempt.
   * When omitted, the component uses the ToastContext (if available).
   */
  readonly onCopyToast?: (opts: { title: string; variant?: string }) => void;
}

/**
 * Masked secret field with reveal toggle and clipboard copy.
 *
 * - Renders `<input type="password">` by default
 * - Reveal button toggles between `type="password"` and `type="text"`
 * - Copy button writes the value to the clipboard and fires a toast
 *   (via ToastContext when available, or `onCopyToast` prop as fallback)
 * - Auto-registers `descriptor.name` as a secret field for autosave scrubbing
 * - Autosave integration: use `scrubSecrets()` to replace raw values with the
 *   `SECRET_SENTINEL` before persisting.
 */
export function SecretField({ descriptor, field, error, onCopyToast }: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const toastCtx = useContext(ToastContext);

  // Auto-register this field name for autosave scrubbing on mount
  useEffect(() => {
    SECRET_FIELD_NAMES.add(descriptor.name);
  }, [descriptor.name]);

  const errorId = `error-${descriptor.name}`;
  const displayValue = field.value !== null && field.value !== undefined ? String(field.value) : "";

  const showToast = useCallback(
    (opts: { title: string; variant?: string }) => {
      if (onCopyToast) {
        onCopyToast(opts);
      } else if (toastCtx) {
        const variant: ToastVariant = (opts.variant as ToastVariant | undefined) ?? "default";
        toastCtx.show({ title: opts.title, variant });
      }
    },
    [onCopyToast, toastCtx],
  );

  const toggleReveal = useCallback(() => {
    setRevealed((prev) => !prev);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayValue);
      showToast({ title: "Copied to clipboard", variant: "success" });
    } catch {
      showToast({ title: "Failed to copy", variant: "error" });
    }
  }, [displayValue, showToast]);

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
