import { useCallback, useEffect, useMemo } from "react";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";
import { SchemaForm } from "@/features/property-grid/SchemaForm";
import { PropertyGridHeader } from "@/features/property-grid/PropertyGridHeader";
import { useValidation } from "@/features/property-grid/ValidationContext";

/**
 * Property grid panel bound to the current node selection.
 *
 * - Reads `lastSelectedNodeId` from the selection slice
 * - Resolves the node's spec (with `propertySchema`) from the registry
 * - Renders `PropertyGridHeader` (kind badge, editable label, copyable id)
 * - Renders `SchemaForm` for the node's data
 * - Shows error count badge when validation errors exist
 * - Reports validation state via `ValidationContext` for Toolbar integration
 * - Clears validation state when no form is active (unmount / deselect)
 * - Shows "Select a node" empty state when nothing is selected
 */
export function PropertyGrid() {
  const lastSelectedNodeId = useWorkflowStore((s) => s.lastSelectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const { errorCount, setValidation } = useValidation();

  const node = useMemo(
    () => (lastSelectedNodeId ? nodes.find((n) => n.id === lastSelectedNodeId) : undefined),
    [lastSelectedNodeId, nodes],
  );

  const spec = useWorkflowStore((s) => (node ? selectNodeSpec(s, node.kind) : undefined));

  const nodeData = node?.data as Record<string, unknown> | undefined;
  const hasActiveForm = Boolean(node && spec && nodeData);

  // Clear validation state when the form is not active (no node selected, unmount, etc.)
  useEffect(() => {
    if (!hasActiveForm) {
      setValidation(0, []);
    }
  }, [hasActiveForm, setValidation]);

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

  const handleValidationChange = useCallback(
    (count: number, messages: string[]) => {
      setValidation(count, messages);
    },
    [setValidation],
  );

  const nodeLabel = nodeData && typeof nodeData.name === "string" ? nodeData.name : undefined;

  return (
    <div
      role="complementary"
      aria-label="Property Grid"
      style={{ height: "100%", padding: "8px" }}
      data-testid="property-grid"
    >
      <h2>
        Properties
        {errorCount > 0 && (
          <span
            data-testid="error-count-badge"
            style={{
              marginLeft: "8px",
              padding: "2px 6px",
              borderRadius: "10px",
              backgroundColor: "#e53e3e",
              color: "#fff",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
            aria-label={`${String(errorCount)} validation error${errorCount === 1 ? "" : "s"}`}
          >
            {errorCount}
          </span>
        )}
      </h2>
      {node && spec && nodeData ? (
        <div data-testid="property-grid-fields">
          <PropertyGridHeader
            kind={node.kind}
            nodeId={node.id}
            label={nodeLabel}
            onLabelChange={handleLabelChange}
          />
          <SchemaForm
            schema={spec.propertySchema}
            value={nodeData}
            onChange={handleChange}
            onValidationChange={handleValidationChange}
          />
        </div>
      ) : (
        <p data-testid="property-grid-empty">Select a node</p>
      )}
    </div>
  );
}
