import { useCallback, useRef, type ChangeEvent } from "react";
import { CURRENT_SCHEMA_VERSION, type WorkflowGraph } from "@/domain/models/graph";
import { GraphJsonV1 } from "@/domain/serialization/schema.v1";
import { migrate } from "@/domain/serialization/migrate";
import { useToast } from "@/hooks/useToast";

// ─── Props ───────────────────────────────────────────────────────────

export interface ExportButtonProps {
  /** The current workflow graph to export. */
  readonly graph: WorkflowGraph;
  /** Override download behavior (for testing). Defaults to `downloadBlob`. */
  readonly onDownload?: (blob: Blob, filename: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Sanitize a workflow name for use in a filename.
 * Replaces non-alphanumeric characters (except hyphens/underscores) with
 * hyphens, collapses runs, and trims leading/trailing hyphens.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a download filename from the workflow name and current time.
 * Format: `<sanitized-name>_<YYYYMMDD-HHmmss>.json`
 */
export function buildFilename(name: string, now: Date = new Date()): string {
  const sanitized = sanitizeFilename(name) || "workflow";
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = [
    String(now.getFullYear()),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
  return `${sanitized}_${ts}.json`;
}

/**
 * Trigger a browser download of the given blob under the given filename.
 * Creates a temporary `<a>` element, clicks it, then cleans up.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────

/**
 * ExportButton serializes the current workflow graph to JSON and triggers
 * a browser file download. The filename includes the workflow name and a
 * timestamp.
 */
export function ExportButton({ graph, onDownload = downloadBlob }: ExportButtonProps) {
  const handleExport = useCallback(() => {
    const json = JSON.stringify(graph, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const filename = buildFilename(graph.name);
    onDownload(blob, filename);
  }, [graph, onDownload]);

  return (
    <button
      type="button"
      data-testid="export-button"
      aria-label="Export workflow"
      onClick={handleExport}
    >
      Export
    </button>
  );
}

// ─── Import validation ───────────────────────────────────────────────

export interface ParseResult {
  readonly ok: true;
  readonly graph: WorkflowGraph;
}

export interface ParseError {
  readonly ok: false;
  readonly message: string;
}

export type ImportParseResult = ParseResult | ParseError;

/**
 * Parse raw text into a validated `WorkflowGraph`.
 *
 * 1. Attempts `JSON.parse`.
 * 2. Migrates if `schemaVersion` differs from current.
 * 3. Validates against the `GraphJsonV1` Zod schema.
 *
 * Returns a discriminated result — no exceptions thrown.
 */
export function parseImportedJson(text: string): ImportParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, message: "File is not valid JSON." };
  }

  // Migrate if needed
  const obj = raw as Record<string, unknown> | null;
  const version = obj?.schemaVersion;
  if (typeof version === "number" && version !== CURRENT_SCHEMA_VERSION) {
    try {
      raw = migrate(raw);
    } catch (e: unknown) {
      return { ok: false, message: `Migration failed: ${String(e)}` };
    }
  }

  const result = GraphJsonV1.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      message: `Invalid workflow: ${result.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const parsed = result.data;
  const graph: WorkflowGraph = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: parsed.id,
    name: parsed.name,
    nodes: parsed.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      position: { x: n.position.x, y: n.position.y },
      data: n.data,
    })),
    edges: parsed.edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourcePort: e.sourcePort,
      target: e.target,
      targetPort: e.targetPort,
      kind: e.kind,
      ...(e.label === undefined ? {} : { label: e.label }),
      ...(e.condition === undefined ? {} : { condition: e.condition }),
    })),
  };

  return { ok: true, graph };
}

// ─── ImportButton props ──────────────────────────────────────────────

export interface ImportButtonProps {
  /** Called with the validated graph after the user confirms import. */
  readonly onImport: (graph: WorkflowGraph) => void;
  /**
   * Optional additional error callback. The component always shows an
   * error toast; this callback is invoked in addition to the toast.
   */
  readonly onError?: (message: string) => void;
  /**
   * Confirmation function. Returns `true` to proceed, `false` to cancel.
   * Defaults to `window.confirm`.
   */
  readonly confirm?: (message: string) => boolean;
}

// ─── ImportButton component ──────────────────────────────────────────

/**
 * ImportButton renders an "Import" button that opens a hidden file input.
 * When a file is selected:
 * 1. Reads the file as text.
 * 2. Parses and validates the JSON against the workflow schema.
 * 3. Shows a confirmation dialog before replacing the current graph.
 * 4. Calls `onImport` with the parsed graph or `onError` with an error message.
 */
export function ImportButton({
  onImport,
  onError,
  // eslint-disable-next-line no-alert -- intentional user confirmation dialog
  confirm: confirmFn = (msg: string) => window.confirm(msg),
}: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const result = parseImportedJson(text);

        if (!result.ok) {
          toast.show({
            title: "Import failed",
            description: result.message,
            variant: "error",
          });
          onError?.(result.message);
          return;
        }

        const proceed = confirmFn(
          `Import "${result.graph.name}"? This will replace the current workflow.`,
        );
        if (!proceed) return;

        onImport(result.graph);
      };
      reader.readAsText(file);

      // Reset the input so the same file can be re-selected
      e.target.value = "";
    },
    [onImport, onError, confirmFn, toast],
  );

  return (
    <>
      <button
        type="button"
        data-testid="import-button"
        aria-label="Import workflow"
        onClick={handleClick}
      >
        Import
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        data-testid="import-file-input"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </>
  );
}
