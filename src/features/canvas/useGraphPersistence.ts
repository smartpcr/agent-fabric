import { useEffect, useRef } from "react";
import { useWorkflowStore } from "@/store/hooks";
import type { WorkflowNode } from "@/domain/models/node";
import type { WorkflowEdge } from "@/domain/models/edge";
import { scrubSecrets } from "@/features/property-grid/fields/SecretField";

export const GRAPH_STORAGE_KEY = "agent-fabric:graph";

interface PersistedGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function isPersistedGraph(val: unknown): val is PersistedGraph {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return Array.isArray(obj.nodes) && Array.isArray(obj.edges);
}

/**
 * Persist workflow graph (nodes + edges) to localStorage and restore on mount.
 * Saves after every change so edits survive a page reload.
 * Secret field values are scrubbed before writing to avoid storing raw secrets.
 * Only restores when the store starts empty (avoids overwriting test fixtures).
 */
export function useGraphPersistence() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const restoreGraph = useWorkflowStore((s) => s.restoreGraph);

  const restoredRef = useRef(false);

  // Snapshot the initial node count at first render so we only restore
  // into a genuinely empty store (not one populated by test setup).
  const initialCountRef = useRef(nodes.length);

  // Restore graph from localStorage on first mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    // Only restore if the store was empty at mount time
    if (initialCountRef.current > 0) return;

    try {
      const raw = localStorage.getItem(GRAPH_STORAGE_KEY);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (isPersistedGraph(saved) && saved.nodes.length > 0) {
          restoreGraph(saved.nodes, saved.edges);
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }, [restoreGraph]);

  // Save graph to localStorage on every change, scrubbing secret fields
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      const scrubbedNodes = scrubSecrets([...nodes]) as WorkflowNode[];
      const scrubbedEdges = scrubSecrets([...edges]) as WorkflowEdge[];
      const payload: PersistedGraph = { nodes: scrubbedNodes, edges: scrubbedEdges };
      localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [nodes, edges]);
}
