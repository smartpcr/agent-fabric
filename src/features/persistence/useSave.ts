import { useState, useCallback } from "react";
import { useWorkflowRepo } from "@/hooks/useWorkflowRepo";
import { useToast } from "@/hooks/useToast";
import type { WorkflowGraph } from "@/domain/models/graph";
import type { Result } from "@/domain/result";
import type { SaveResult, RepositoryError } from "@/ports/IWorkflowRepository";

// ─── Types ───────────────────────────────────────────────────────────

export interface UseSaveOptions {
  /** Called when a conflict is resolved by reloading the server version. */
  readonly onReload?: (id: string) => void;
}

export interface UseSaveReturn {
  /** Save a workflow with ETag-based optimistic concurrency. */
  save: (id: string, graph: WorkflowGraph) => Promise<Result<SaveResult, RepositoryError>>;
  /** Whether a save is currently in-flight. */
  saving: boolean;
  /** The current ETag, updated after each successful save or load. */
  etag: string | null;
  /** Update the tracked ETag (e.g. after loading a workflow). */
  setEtag: (etag: string | null) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────

/**
 * Hook that wraps `useWorkflowRepo().save` with ETag-based optimistic
 * concurrency. When the server returns 409 CONFLICT, a toast is shown
 * with "Reload" and "Force save" action buttons.
 *
 * - **Reload** fetches the latest version from the server and calls
 *   `onReload` so the consumer can update the UI.
 * - **Force save** re-issues the save without an ETag, overwriting
 *   whatever is on the server.
 */
export function useSave(options: UseSaveOptions = {}): UseSaveReturn {
  const repo = useWorkflowRepo();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [etag, setEtag] = useState<string | null>(null);

  const save = useCallback(
    async (id: string, graph: WorkflowGraph): Promise<Result<SaveResult, RepositoryError>> => {
      setSaving(true);

      try {
        const result = await repo.save(id, graph, etag ?? undefined);

        if (result.ok) {
          setEtag(result.value.etag);
          return result;
        }

        if (result.error.code === "CONFLICT") {
          // Capture current values for the action closures
          const conflictId = id;
          const conflictGraph = graph;

          // Show actionable conflict toast
          toast.show({
            title: "Workflow changed elsewhere",
            description:
              "Another user saved this workflow. Reload the latest version or force your save.",
            variant: "error",
            actions: [
              {
                label: "Reload",
                onClick: () => {
                  void (async () => {
                    const loaded = await repo.load(conflictId);
                    if (loaded.ok) {
                      setEtag(loaded.value.etag);
                      options.onReload?.(conflictId);
                    }
                  })();
                },
              },
              {
                label: "Force save",
                onClick: () => {
                  void (async () => {
                    setSaving(true);
                    try {
                      const forced = await repo.save(conflictId, conflictGraph, undefined);
                      if (forced.ok) {
                        setEtag(forced.value.etag);
                      }
                    } finally {
                      setSaving(false);
                    }
                  })();
                },
              },
            ],
          });

          return result;
        }

        // Non-conflict errors surface as-is
        return result;
      } finally {
        setSaving(false);
      }
    },
    [repo, toast, etag, options],
  );

  return { save, saving, etag, setEtag };
}
