import { useCallback, useMemo } from "react";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";
import { SchemaForm } from "@/features/property-grid/SchemaForm";
import { PropertyGridHeader } from "@/features/property-grid/PropertyGridHeader";

/**
 * Property grid panel bound to the current node selection.
 *
 * - Reads `lastSelectedNodeId` from the selection slice
 * - Resolves the node's spec (with `propertySchema`) from the registry
 * - Renders `PropertyGridHeader` (kind badge, editable label, copyable id)
 * - Renders `SchemaForm` for the node's data
 * - Shows "Select a node" empty state when nothing is selected
 */
export function PropertyGrid() {
  const lastSelectedNodeId = useWorkflowStore((s) => s.lastSelectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const node = useMemo(
    () => (lastSelectedNodeId ? nodes.find((n) => n.id === lastSelectedNodeId) : undefined),
    [lastSelectedNodeId, nodes],
  );

  const spec = useWorkflowStore((s) => (node ? selectNodeSpec(s, node.kind) : undefined));

  const handleChange = useCallback(
    (value: Record<string, unknown>) => {
      if (node) {
        updateNodeData(node.id, value);
      }
    },
    [node, updateNodeData],
  );

  const handleLabelChange = useCallback(
    (newLabel: string) => {
      if (node) {
        const current = node.data as Record<string, unknown>;
        updateNodeData(node.id, { ...current, name: newLabel });
      }
    },
    [node, updateNodeData],
  );

  const nodeData = node?.data as Record<string, unknown> | undefined;
  const nodeLabel = nodeData && typeof nodeData.name === "string" ? nodeData.name : undefined;

  return (
    <div
      role="complementary"
      aria-label="Property Grid"
      style={{ height: "100%", padding: "8px" }}
      data-testid="property-grid"
    >
      <h2>Properties</h2>
      {node && spec && nodeData ? (
        <div data-testid="property-grid-fields">
          <PropertyGridHeader
            kind={node.kind}
            nodeId={node.id}
            label={nodeLabel}
            onLabelChange={handleLabelChange}
          />
          <SchemaForm schema={spec.propertySchema} value={nodeData} onChange={handleChange} />
        </div>
      ) : (
        <p data-testid="property-grid-empty">Select a node</p>
      )}
    </div>
  );
}
