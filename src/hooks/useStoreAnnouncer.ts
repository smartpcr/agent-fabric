import { useEffect, useRef } from "react";
import { useAnnounce } from "@/hooks/useAnnounce";
import { useWorkflowStore } from "@/store/hooks";
import type { RunStatus } from "@/store/slices/executionSlice";

/**
 * Watches the workflow store for selection changes, connection results,
 * and run state transitions, then pushes announcements into the
 * `AnnouncerProvider` live region so screen readers pick them up.
 *
 * Should be rendered once inside the editor tree (below AnnouncerProvider).
 */
export function useStoreAnnouncer(): void {
  const { announce } = useAnnounce();

  // ── Selection changes ──────────────────────────────────────────────
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useWorkflowStore((s) => s.selectedEdgeIds);
  const nodes = useWorkflowStore((s) => s.nodes);

  const prevNodeIds = useRef<string[]>(selectedNodeIds);
  const prevEdgeIds = useRef<string[]>(selectedEdgeIds);

  useEffect(() => {
    const prevN = prevNodeIds.current;
    const prevE = prevEdgeIds.current;
    prevNodeIds.current = selectedNodeIds;
    prevEdgeIds.current = selectedEdgeIds;

    // Skip the initial mount
    if (prevN === selectedNodeIds && prevE === selectedEdgeIds) return;

    const nodeCount = selectedNodeIds.length;
    const edgeCount = selectedEdgeIds.length;

    if (nodeCount === 0 && edgeCount === 0) {
      announce("Selection cleared");
      return;
    }

    const parts: string[] = [];
    if (nodeCount === 1) {
      const node = nodes.find((n) => n.id === selectedNodeIds[0]);
      const label: string =
        (node?.data?.label as string | undefined) ?? node?.kind ?? selectedNodeIds[0] ?? "unknown";
      parts.push(`${label} node selected`);
    } else if (nodeCount > 1) {
      parts.push(`${String(nodeCount)} nodes selected`);
    }
    if (edgeCount === 1) {
      parts.push("1 edge selected");
    } else if (edgeCount > 1) {
      parts.push(`${String(edgeCount)} edges selected`);
    }
    announce(parts.join(", "));
  }, [selectedNodeIds, selectedEdgeIds, nodes, announce]);

  // ── Connection results ─────────────────────────────────────────────
  const edges = useWorkflowStore((s) => s.edges);
  const prevEdgeCount = useRef(edges.length);

  useEffect(() => {
    const prev = prevEdgeCount.current;
    prevEdgeCount.current = edges.length;

    // Skip initial mount
    if (prev === edges.length) return;

    if (edges.length > prev) {
      announce("Connection added");
    } else if (edges.length < prev) {
      announce("Connection removed");
    }
  }, [edges.length, announce]);

  // ── Run state transitions ──────────────────────────────────────────
  const activeRunId = useWorkflowStore((s) => s.activeRunId);
  const runs = useWorkflowStore((s) => s.runs);

  const prevRunStatus = useRef<RunStatus | undefined>(undefined);
  const prevRunId = useRef<string | undefined>(activeRunId);

  useEffect(() => {
    const run = activeRunId === undefined ? undefined : runs.get(activeRunId);
    const status = run?.status;
    if (status === prevRunStatus.current && prevRunId.current === activeRunId) return;
    prevRunId.current = activeRunId;
    prevRunStatus.current = status;

    if (status === undefined) return;

    const messages: Record<RunStatus, string> = {
      running: "Workflow run started",
      completed: "Workflow run completed",
      failed: "Workflow run failed",
      cancelled: "Workflow run cancelled",
    };

    announce(messages[status]);
  }, [activeRunId, runs, announce]);
}
