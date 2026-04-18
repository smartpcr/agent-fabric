import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

export interface ValidationState {
  /** Number of active validation errors in the property grid form. */
  readonly errorCount: number;
  /** Human-readable error messages for the current form. */
  readonly errorMessages: readonly string[];
  /** Update the validation state. Called by PropertyGrid when SchemaForm errors change. */
  readonly setValidation: (errorCount: number, errorMessages: readonly string[]) => void;
}

const ValidationContext = createContext<ValidationState | null>(null);

/**
 * Provides validation state to child components (PropertyGrid, Toolbar).
 * Allows the property grid form to report validation errors that gate
 * the toolbar Save button.
 */
export function ValidationProvider({ children }: { readonly children: ReactNode }) {
  const [errorCount, setErrorCount] = useState(0);
  const [errorMessages, setErrorMessages] = useState<readonly string[]>([]);

  const setValidation = useCallback((count: number, messages: readonly string[]) => {
    setErrorCount(count);
    setErrorMessages(messages);
  }, []);

  const value = useMemo(
    () => ({ errorCount, errorMessages, setValidation }),
    [errorCount, errorMessages, setValidation],
  );

  return <ValidationContext.Provider value={value}>{children}</ValidationContext.Provider>;
}

/**
 * Access the validation state. Returns `{ errorCount, errorMessages, setValidation }`.
 * Returns null values if used outside of ValidationProvider (safe fallback for tests).
 */
export function useValidation(): ValidationState {
  const ctx = useContext(ValidationContext);
  if (ctx === null) {
    // eslint-disable-next-line no-empty-function -- intentional noop fallback
    return { errorCount: 0, errorMessages: [], setValidation: () => {} };
  }
  return ctx;
}

export { ValidationContext };
