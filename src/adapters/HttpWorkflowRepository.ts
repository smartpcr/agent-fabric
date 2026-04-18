import type {
  IWorkflowRepository,
  RepositoryError,
  WorkflowSummary,
  WorkflowEnvelope,
  SaveResult,
} from "@/ports/IWorkflowRepository";
import type { WorkflowGraph } from "@/domain/models/graph";
import { ok, err, type Result } from "@/domain/result";

// ─── Configuration ───────────────────────────────────────────────────

export interface HttpWorkflowRepositoryOptions {
  /** Base URL for the workflows API (e.g. `/api/workflows`). */
  readonly baseUrl: string;
  /** Custom fetch implementation (for testing). Defaults to `globalThis.fetch`. */
  readonly fetch?: typeof globalThis.fetch;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function networkError(message: string): RepositoryError {
  return { code: "NETWORK", message };
}

function notFoundError(id: string): RepositoryError {
  return { code: "NOT_FOUND", message: `Workflow "${id}" not found`, status: 404 };
}

function conflictError(): RepositoryError {
  return {
    code: "CONFLICT",
    message: "Workflow was modified by another user",
    status: 409,
  };
}

function unknownError(status: number, body: string): RepositoryError {
  return {
    code: "UNKNOWN",
    message: `Unexpected status ${String(status)}: ${body}`,
    status,
  };
}

// ─── Implementation ──────────────────────────────────────────────────

export class HttpWorkflowRepository implements IWorkflowRepository {
  private readonly baseUrl: string;

  private readonly _fetch: typeof globalThis.fetch;

  constructor(options: HttpWorkflowRepositoryOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this._fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async list(): Promise<Result<readonly WorkflowSummary[], RepositoryError>> {
    let res: Response;
    try {
      res = await this._fetch(this.baseUrl);
    } catch (e: unknown) {
      return err(networkError(e instanceof Error ? e.message : "Network error"));
    }

    if (!res.ok) {
      const body = await this.safeText(res);
      return err(unknownError(res.status, body));
    }

    const data: readonly WorkflowSummary[] = (await res.json()) as readonly WorkflowSummary[];
    return ok(data);
  }

  async get(id: string): Promise<Result<WorkflowEnvelope, RepositoryError>> {
    let res: Response;
    try {
      res = await this._fetch(`${this.baseUrl}/${id}`);
    } catch (e: unknown) {
      return err(networkError(e instanceof Error ? e.message : "Network error"));
    }

    if (res.status === 404) {
      return err(notFoundError(id));
    }

    if (!res.ok) {
      const body = await this.safeText(res);
      return err(unknownError(res.status, body));
    }

    const graph: WorkflowGraph = (await res.json()) as WorkflowGraph;
    const etag = res.headers.get("etag") ?? "";
    return ok({ graph, etag });
  }

  async save(
    id: string,
    graph: WorkflowGraph,
    etag?: string,
  ): Promise<Result<SaveResult, RepositoryError>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (etag !== undefined) {
      headers["If-Match"] = etag;
    }

    let res: Response;
    try {
      res = await this._fetch(`${this.baseUrl}/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(graph),
      });
    } catch (e: unknown) {
      return err(networkError(e instanceof Error ? e.message : "Network error"));
    }

    if (res.status === 404) {
      return err(notFoundError(id));
    }

    if (res.status === 409) {
      return err(conflictError());
    }

    if (!res.ok) {
      const body = await this.safeText(res);
      return err(unknownError(res.status, body));
    }

    const newEtag = res.headers.get("etag") ?? "";
    return ok({ id, etag: newEtag });
  }

  async create(graph: WorkflowGraph): Promise<Result<SaveResult, RepositoryError>> {
    let res: Response;
    try {
      res = await this._fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graph),
      });
    } catch (e: unknown) {
      return err(networkError(e instanceof Error ? e.message : "Network error"));
    }

    if (!res.ok) {
      const body = await this.safeText(res);
      return err(unknownError(res.status, body));
    }

    const data = (await res.json()) as { id: string };
    const etag = res.headers.get("etag") ?? "";
    return ok({ id: data.id, etag });
  }

  private async safeText(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }
}
