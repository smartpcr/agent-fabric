import { useState, useCallback, useMemo } from "react";
import type { z } from "zod";
import { useTranslation } from "react-i18next";
import type { FieldComponentProps, FieldResolver } from "@/features/property-grid/registry";
import { SchemaFormFields } from "@/features/property-grid/SchemaForm";

// ─── Session-storage helpers ─────────────────────────────────────────

/** Build the sessionStorage key for a given field's collapse state. */
function storageKey(fieldName: string): string {
  return `object-field-collapsed:${fieldName}`;
}

/** Read the persisted collapse state (defaults to expanded / not collapsed). */
function readCollapsed(fieldName: string): boolean {
  try {
    return sessionStorage.getItem(storageKey(fieldName)) === "true";
  } catch {
    return false;
  }
}

/** Persist the collapse state. */
function writeCollapsed(fieldName: string, collapsed: boolean): void {
  try {
    sessionStorage.setItem(storageKey(fieldName), String(collapsed));
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

// ─── ObjectField props ──────────────────────────────────────────────

export interface ObjectFieldProps extends FieldComponentProps {
  /**
   * Zod schema for the nested object. When provided, the object is rendered
   * recursively through `SchemaFormFields`.
   */
  readonly objectSchema?: z.ZodType;
  /** Optional field resolver/registry for nested fields. */
  readonly fieldRegistry?: FieldResolver;
  /**
   * Child field error messages keyed by child name.
   * Used to aggregate nested errors into the parent summary.
   */
  readonly childErrors?: Readonly<Record<string, string | undefined>>;
}

// ─── ObjectField ────────────────────────────────────────────────────

/**
 * Collapsible object field with nested `SchemaForm` rendering.
 *
 * - Renders a `<details>`-like disclosure UI for expand/collapse
 * - Collapse state persists via sessionStorage
 * - Nested object rendered recursively through `SchemaFormFields`
 * - Aggregates nested child errors into a parent-level count badge
 */
export function ObjectField({
  descriptor,
  field,
  error,
  objectSchema,
  fieldRegistry,
  childErrors,
}: ObjectFieldProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(descriptor.name));

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(descriptor.name, next);
      return next;
    });
  }, [descriptor.name]);

  // Compute the current object value, defaulting to empty object
  const objValue = useMemo(() => {
    if (typeof field.value === "object" && field.value !== null) {
      return field.value as Record<string, unknown>;
    }
    return {};
  }, [field.value]);

  // Aggregate nested errors into a count
  const nestedErrorCount = useMemo(() => {
    if (!childErrors) return 0;
    return Object.values(childErrors).filter(Boolean).length;
  }, [childErrors]);

  // Display error: explicit error takes priority, then aggregated count
  const displayError = useMemo(() => {
    if (error) return error;
    if (nestedErrorCount > 0) {
      return t("propertyGrid.nestedErrors", { count: nestedErrorCount });
    }
    return undefined;
  }, [error, nestedErrorCount, t]);

  const errorId = `error-${descriptor.name}`;

  return (
    <div data-testid={`object-field-${descriptor.name}`}>
      <div data-testid={`object-header-${descriptor.name}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls={`object-content-${descriptor.name}`}
          data-testid={`object-toggle-${descriptor.name}`}
          aria-label={
            collapsed
              ? t("propertyGrid.expand", { name: descriptor.name })
              : t("propertyGrid.collapse", { name: descriptor.name })
          }
        >
          <span aria-hidden="true">{collapsed ? "▶" : "▼"}</span>
          {descriptor.name}
        </button>

        {displayError && (
          <span id={errorId} role="alert" data-testid={`error-${descriptor.name}`}>
            {displayError}
          </span>
        )}

        {nestedErrorCount > 0 && !error && (
          <span
            data-testid={`error-count-${descriptor.name}`}
            aria-label={t("propertyGrid.errorCount", { count: nestedErrorCount })}
          >
            {nestedErrorCount}
          </span>
        )}
      </div>

      {!collapsed && (
        <div
          id={`object-content-${descriptor.name}`}
          data-testid={`object-content-${descriptor.name}`}
          role="group"
          aria-label={t("propertyGrid.fields", { name: descriptor.name })}
        >
          {objectSchema ? (
            <SchemaFormFields
              schema={objectSchema}
              value={objValue}
              onChange={(newVal) => {
                field.onChange(newVal);
              }}
              fieldRegistry={fieldRegistry}
            />
          ) : (
            <span data-testid={`object-no-schema-${descriptor.name}`}>
              {t("propertyGrid.noSchema")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
