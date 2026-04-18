import { useContext, useCallback } from "react";
import { WorkflowRepoContext } from "@/providers/RepositoryProvider";
import type { WorkflowGraph } from "@/domain/models/graph";
import type { Result } from "@/domain/result";
import type {
  RepositoryError,
  WorkflowEnvelope,
  SaveResult,
  WorkflowSummary,
} from "@/ports/IWorkflowRepository";

export interface UseWorkflowRepoReturn {
  /** Load a workflow by id. Returns the graph + ETag envelope. */
  load: (id: string) => Promise<Result<WorkflowEnvelope, RepositoryError>>;

  /** Save an existing workflow. Optionally pass ETag for concurrency. */
  save: (
    id: string,
    graph: WorkflowGraph,
    etag?: string,
  ) => Promise<Result<SaveResult, RepositoryError>>;

  /** Create a new workflow. */
  create: (graph: WorkflowGraph) => Promise<Result<SaveResult, RepositoryError>>;

  /** List available workflows. */
  list: () => Promise<Result<readonly WorkflowSummary[], RepositoryError>>;
}

export function useWorkflowRepo(): UseWorkflowRepoReturn {
  const repo = useContext(WorkflowRepoContext);
  if (repo === null) {
    throw new Error("useWorkflowRepo used outside of provider");
  }

  const load = useCallback((id: string) => repo.get(id), [repo]);

  const save = useCallback(
    (id: string, graph: WorkflowGraph, etag?: string) => repo.save(id, graph, etag),
    [repo],
  );

  const create = useCallback((graph: WorkflowGraph) => repo.create(graph), [repo]);

  const list = useCallback(() => repo.list(), [repo]);

  return { load, save, create, list };
}
