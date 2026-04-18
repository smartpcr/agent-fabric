import { getLayoutOptions, type LayoutStrategy } from "@/domain/layout/layoutOptions";
import { getElk } from "@/domain/layout/elkLoader";
import { toElkGraph, fromElkLayout } from "@/domain/layout/elkAdapter";
import type { WorkflowGraph } from "@/domain/models/graph";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";

/**
 * Run ELK auto-layout on the given graph and return a new graph with updated positions.
 */
export async function layoutGraph(
  graph: WorkflowGraph,
  registry: NodeSpecRegistry,
  strategy?: LayoutStrategy,
): Promise<WorkflowGraph> {
  const elk = await getElk();
  const elkGraph = toElkGraph(graph, registry);
  const layoutOptions = getLayoutOptions(strategy);
  const result = await elk.layout(elkGraph, { layoutOptions });
  return fromElkLayout(result, graph);
}
