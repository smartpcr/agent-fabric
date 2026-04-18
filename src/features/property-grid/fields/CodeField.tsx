import { Suspense, lazy, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { FieldComponentProps } from "@/features/property-grid/registry";

// ─── Language hint extraction ────────────────────────────────────────

/**
 * Extract a language hint from the descriptor's description field.
 * Supports JSON-like `{ language: 'javascript' }` or `{ "language": "python" }`.
 * Falls back to "plaintext" if no hint is found or parsing fails.
 */
export function extractLanguage(description?: string): string {
  if (!description) return "plaintext";
  try {
    // Normalize single quotes to double quotes and unquoted keys for JSON.parse
    const normalized = description.replace(/'/g, '"').replace(/(\w+)\s*:/g, '"$1":');
    const parsed: unknown = JSON.parse(normalized);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "language" in parsed &&
      typeof (parsed as Record<string, unknown>).language === "string"
    ) {
      return (parsed as Record<string, unknown>).language as string;
    }
  } catch {
    // Not valid JSON — ignore
  }
  return "plaintext";
}

// ─── Skeleton placeholder ────────────────────────────────────────────

interface CodeFieldSkeletonProps {
  readonly name: string;
  readonly height: number;
}

/** Skeleton placeholder shown while Monaco is loading. */
export function CodeFieldSkeleton({ name, height }: CodeFieldSkeletonProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={`code-skeleton-${name}`}
      role="status"
      aria-label="Loading code editor"
      style={{
        height: `${String(height)}px`,
        backgroundColor: "#f0f0f0",
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span>{t("propertyGrid.loadingEditor")}</span>
    </div>
  );
}

// ─── Monaco editor wrapper props ─────────────────────────────────────

export interface MonacoEditorWrapperProps {
  readonly value: string;
  readonly language: string;
  readonly height: number;
  readonly onChange: (value: string) => void;
  readonly onBlur: () => void;
  readonly name: string;
  readonly fieldName: string;
  readonly error?: string;
}

// ─── Read-only worker configuration ─────────────────────────────────

/**
 * Configure Monaco's worker environment in read-only mode.
 *
 * Sets `globalThis.MonacoEnvironment.getWorker` to return a minimal
 * no-op worker instead of spawning full language service workers.
 * This keeps the editor lightweight — syntax highlighting works via
 * Monarch grammars (synchronous), while expensive language features
 * (autocomplete, diagnostics) that require workers are disabled.
 *
 * Called once via the `beforeMount` callback before Monaco initializes.
 */
export function configureReadOnlyWorker(): void {
  const monacoEnv = (globalThis as Record<string, unknown>).MonacoEnvironment as
    | Record<string, unknown>
    | undefined;

  if (monacoEnv) {
    monacoEnv.getWorker = () => {
      // Return a minimal Blob-based worker that does nothing
      const blob = new Blob(["// no-op worker"], { type: "application/javascript" });
      return new Worker(URL.createObjectURL(blob));
    };
  } else {
    (globalThis as Record<string, unknown>).MonacoEnvironment = {
      getWorker: () => {
        const blob = new Blob(["// no-op worker"], { type: "application/javascript" });
        return new Worker(URL.createObjectURL(blob));
      },
    };
  }
}

// ─── Lazy Monaco wrapper ─────────────────────────────────────────────

/**
 * Lazy-loaded Monaco editor component.
 * Uses `React.lazy` with a dynamic `import()` for `@monaco-editor/react`.
 * The import is resolved at runtime — if the package is unavailable,
 * the Suspense error boundary will catch it.
 */
const LazyMonacoEditor = lazy(
  () =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- dynamic import typing
    import("@monaco-editor/react").then(
      (mod: { default: React.ComponentType<Record<string, unknown>> }) => ({
        default: function MonacoWrapper(props: MonacoEditorWrapperProps) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- dynamic module default
          const Editor = mod["default"];
          return (
            <div data-testid={`code-editor-${props.fieldName}`}>
              <Editor
                height={`${String(props.height)}px`}
                language={props.language}
                value={props.value}
                beforeMount={() => {
                  configureReadOnlyWorker();
                }}
                onChange={(val: unknown) => {
                  props.onChange((val as string | undefined) ?? "");
                }}
                options={{
                  minimap: { enabled: false },
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  readOnly: false,
                }}
              />
              <input type="hidden" name={props.name} value={props.value} />
              {props.error && (
                <span
                  id={`error-${props.fieldName}`}
                  role="alert"
                  data-testid={`error-${props.fieldName}`}
                >
                  {props.error}
                </span>
              )}
            </div>
          );
        },
      }),
    ) as Promise<{ default: React.ComponentType<MonacoEditorWrapperProps> }>,
);

// ─── Fallback textarea (used when Monaco is disabled) ────────────────

interface FallbackTextareaProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur: () => void;
  readonly name: string;
  readonly fieldName: string;
  readonly height: number;
  readonly error?: string;
}

/** Plain textarea fallback when Monaco is unavailable or disabled. */
export function FallbackTextarea({
  value,
  onChange,
  onBlur,
  name,
  fieldName,
  height,
  error,
}: FallbackTextareaProps) {
  const errorId = `error-${fieldName}`;
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onBlur={onBlur}
        name={name}
        data-testid={`code-fallback-${fieldName}`}
        aria-label={fieldName}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        style={{ height: `${String(height)}px`, width: "100%", fontFamily: "monospace" }}
      />
      {error && (
        <span id={errorId} role="alert" data-testid={`error-${fieldName}`}>
          {error}
        </span>
      )}
    </>
  );
}

// ─── CodeField props ─────────────────────────────────────────────────

export interface CodeFieldProps extends FieldComponentProps {
  /** Override the editor height in pixels. Defaults to 200. */
  readonly height?: number;
  /**
   * When true, skip lazy Monaco import and use the textarea fallback.
   * Useful for testing or environments without Monaco support.
   */
  readonly disableMonaco?: boolean;
}

// ─── Default height ──────────────────────────────────────────────────

const DEFAULT_HEIGHT = 200;

// ─── CodeField ───────────────────────────────────────────────────────

/**
 * Multi-line code field with lazy-loaded Monaco editor.
 *
 * - Lazy-imports `@monaco-editor/react` via `React.lazy` + `Suspense`
 * - Shows a skeleton placeholder during loading
 * - Extracts language hint from `descriptor.description` (e.g. `{ language: 'javascript' }`)
 * - Falls back to a plain `<textarea>` when `disableMonaco` is set
 * - Height is configurable via `height` prop (default: 200px)
 */
export function CodeField({
  descriptor,
  field,
  error,
  height = DEFAULT_HEIGHT,
  disableMonaco = false,
}: CodeFieldProps) {
  const language = useMemo(() => extractLanguage(descriptor.description), [descriptor.description]);

  const displayValue = field.value !== null && field.value !== undefined ? String(field.value) : "";

  if (disableMonaco) {
    return (
      <FallbackTextarea
        value={displayValue}
        onChange={(val) => {
          field.onChange(val);
        }}
        onBlur={field.onBlur}
        name={field.name}
        fieldName={descriptor.name}
        height={height}
        error={error}
      />
    );
  }

  return (
    <Suspense fallback={<CodeFieldSkeleton name={descriptor.name} height={height} />}>
      <LazyMonacoEditor
        value={displayValue}
        language={language}
        height={height}
        onChange={(val) => {
          field.onChange(val);
        }}
        onBlur={field.onBlur}
        name={field.name}
        fieldName={descriptor.name}
        error={error}
      />
    </Suspense>
  );
}
