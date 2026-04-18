import type { WorkflowGraph } from "@/domain/models/graph";
import type { Result } from "@/domain/result";

// ─── Error types ─────────────────────────────────────────────────────

export type RepositoryErrorCode = "NOT_FOUND" | "CONFLICT" | "NETWORK" | "UNKNOWN";

export interface RepositoryError {
  readonly code: RepositoryErrorCode;
  readonly message: string;
  /** HTTP status code when available. */
  readonly status?: number;
}

// ─── Workflow summary (returned by list) ─────────────────────────────

export interface WorkflowSummary {
  readonly id: string;
  readonly name: string;
}

// ─── Envelope with ETag for concurrency ──────────────────────────────

export interface WorkflowEnvelope {
  readonly graph: WorkflowGraph;
  readonly etag: string;
}

// ─── Save result ─────────────────────────────────────────────────────

export interface SaveResult {
  readonly id: string;
  readonly etag: string;
}

// ─── Port interface ──────────────────────────────────────────────────

/** Port interface for workflow persistence operations. */
export interface IWorkflowRepository {
  /** List available workflows. */
  list(): Promise<Result<readonly WorkflowSummary[], RepositoryError>>;

  /** Load a workflow definition by id. */
  get(id: string): Promise<Result<WorkflowEnvelope, RepositoryError>>;

  /** Persist an existing workflow (ETag-based concurrency). */
  save(
    id: string,
    graph: WorkflowGraph,
    etag?: string,
  ): Promise<Result<SaveResult, RepositoryError>>;

  /** Create a new workflow. */
  create(graph: WorkflowGraph): Promise<Result<SaveResult, RepositoryError>>;
}
