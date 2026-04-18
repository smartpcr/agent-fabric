import { useCallback } from "react";
import type { WorkflowGraph } from "@/domain/models/graph";

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
