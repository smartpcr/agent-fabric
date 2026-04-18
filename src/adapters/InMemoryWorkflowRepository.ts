import type {
  IWorkflowRepository,
  RepositoryError,
  WorkflowSummary,
  WorkflowEnvelope,
  SaveResult,
} from "@/ports/IWorkflowRepository";
import type { WorkflowGraph } from "@/domain/models/graph";
import { ok, err, type Result } from "@/domain/result";

// ─── Internal record stored per workflow ─────────────────────────────

interface StoredWorkflow {
  graph: WorkflowGraph;
  version: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function versionToEtag(version: number): string {
  return `"v${String(version)}"`;
}

// ─── Implementation ──────────────────────────────────────────────────

/**
 * In-memory `IWorkflowRepository` backed by a `Map`.
 *
 * ETag concurrency is simulated via an auto-incrementing version counter
 * per workflow. Useful for tests, demos, and offline-first scenarios.
 */
export class InMemoryWorkflowRepository implements IWorkflowRepository {
  private readonly store = new Map<string, StoredWorkflow>();

  // eslint-disable-next-line @typescript-eslint/require-await -- interface requires Promise
  async list(): Promise<Result<readonly WorkflowSummary[], RepositoryError>> {
    const summaries: WorkflowSummary[] = [];
    for (const [id, entry] of this.store) {
      summaries.push({ id, name: entry.graph.name });
    }
    return ok(summaries);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface requires Promise
  async get(id: string): Promise<Result<WorkflowEnvelope, RepositoryError>> {
    const entry = this.store.get(id);
    if (entry === undefined) {
      return err({ code: "NOT_FOUND", message: `Workflow "${id}" not found` });
    }
    return ok({ graph: entry.graph, etag: versionToEtag(entry.version) });
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface requires Promise
  async save(
    id: string,
    graph: WorkflowGraph,
    etag?: string,
  ): Promise<Result<SaveResult, RepositoryError>> {
    const entry = this.store.get(id);
    if (entry === undefined) {
      return err({ code: "NOT_FOUND", message: `Workflow "${id}" not found` });
    }

    if (etag !== undefined && etag !== versionToEtag(entry.version)) {
      return err({
        code: "CONFLICT",
        message: "Workflow was modified by another user",
      });
    }

    const nextVersion = entry.version + 1;
    this.store.set(id, { graph, version: nextVersion });
    return ok({ id, etag: versionToEtag(nextVersion) });
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface requires Promise
  async create(graph: WorkflowGraph): Promise<Result<SaveResult, RepositoryError>> {
    const id = graph.id;
    const version = 1;
    this.store.set(id, { graph, version });
    return ok({ id, etag: versionToEtag(version) });
  }
}
