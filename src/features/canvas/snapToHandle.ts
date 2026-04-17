import type { WorkflowGraph } from "@/domain/models/graph";
import { validateConnection, type NodeSpecRegistry } from "@/domain/validation/connectionRules";

export interface HandlePosition {
  readonly nodeId: string;
  readonly portId: string;
  readonly x: number;
  readonly y: number;
}

export interface SnapResult {
  readonly nodeId: string;
  readonly portId: string;
  readonly distance: number;
}

const SNAP_RADIUS = 20;

/**
 * Find the nearest compatible handle within `radius` pixels of the given point.
 *
 * @param point - The cursor position in flow coordinates.
 * @param sourceNodeId - The node that started the drag.
 * @param sourcePortId - The port on that node.
 * @param handles - All candidate target handles with their positions.
 * @param graph - Current graph state for validation.
 * @param registry - Node spec registry for port/type lookups.
 * @param radius - Maximum snap distance in pixels (default 20).
 * @returns The closest compatible handle within radius, or `null` if none qualifies.
 */
export function findSnapTarget(
  point: { readonly x: number; readonly y: number },
  sourceNodeId: string,
  sourcePortId: string,
  handles: readonly HandlePosition[],
  graph: WorkflowGraph,
  registry: NodeSpecRegistry,
  radius: number = SNAP_RADIUS,
): SnapResult | null {
  let best: SnapResult | null = null;

  for (const handle of handles) {
    const dx = handle.x - point.x;
    const dy = handle.y - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > radius) continue;
    if (best !== null && distance >= best.distance) continue;

    const result = validateConnection(
      graph,
      { nodeId: sourceNodeId, portId: sourcePortId },
      { nodeId: handle.nodeId, portId: handle.portId },
      registry,
    );

    if (result.ok) {
      best = { nodeId: handle.nodeId, portId: handle.portId, distance };
    }
  }

  return best;
}
