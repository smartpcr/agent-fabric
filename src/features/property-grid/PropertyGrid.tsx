import { useCallback, useEffect, useMemo } from "react";
import type { z } from "zod";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";
import { SchemaForm } from "@/features/property-grid/SchemaForm";
import { PropertyGridHeader } from "@/features/property-grid/PropertyGridHeader";
import { useValidation } from "@/features/property-grid/ValidationContext";
import { useDebouncedCommit } from "@/features/property-grid/useDebouncedCommit";

/** Sentinel value used as placeholder for fields with differing values across selected nodes. */
export const MIXED_SENTINEL = "__mixed__";

/**
 * Compute common field values across multiple node data objects.
 * Fields with the same value across all nodes retain that value;
 * differing fields get the `MIXED_SENTINEL` placeholder.
 */
export function computeCommonValues(dataList: Record<string, unknown>[]): Record<string, unknown> {
  if (dataList.length === 0) return {};
  if (dataList.length === 1) return { ...dataList[0] };

  const base = dataList[0];
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(base)) {
    const baseVal = base[key];
    const allSame = dataList.every((d) => {
      const v = d[key];
      if (typeof baseVal === "object" && baseVal !== null) {
        return JSON.stringify(v) === JSON.stringify(baseVal);
      }
      return v === baseVal;
    });
    result[key] = allSame ? baseVal : MIXED_SENTINEL;
  }

  return result;
}

/** Renders the property grid content area based on selection state. */
function PropertyGridContent({
  isMultiSelect,
  multiSelectKind,
  hasActiveForm,
  spec,
  formValue,
  selectedNodes,
  headerKind,
  headerId,
  nodeLabel,
  handleLabelChange,
  handleChange,
  handleValidationChange,
}: {
  readonly isMultiSelect: boolean;
  readonly multiSelectKind: string | null;
  readonly hasActiveForm: boolean;
  readonly spec: { propertySchema: z.ZodType } | undefined;
  readonly formValue: Record<string, unknown> | undefined;
  readonly selectedNodes: readonly { id: string }[];
  readonly headerKind: string;
  readonly headerId: string;
  readonly nodeLabel: string | undefined;
  readonly handleLabelChange: (label: string) => void;
  readonly handleChange: (value: Record<string, unknown>) => void;
  readonly handleValidationChange: (count: number, messages: string[]) => void;
}) {
  if (isMultiSelect && !multiSelectKind) {
    return (
      <p data-testid="property-grid-mixed-kinds">
        Selected nodes have different kinds. Select nodes of the same kind to edit shared
        properties.
      </p>
    );
  }

  if (hasActiveForm && spec && formValue) {
    return (
      <div data-testid="property-grid-fields">
        {isMultiSelect && (
          <p data-testid="multi-select-indicator" style={{ fontSize: "0.85rem", color: "#666" }}>
            Editing {selectedNodes.length} nodes
          </p>
        )}
        <PropertyGridHeader
          kind={headerKind}
          nodeId={headerId}
          label={nodeLabel}
          onLabelChange={handleLabelChange}
        />
        <SchemaForm
          schema={spec.propertySchema}
          value={formValue}
          onChange={handleChange}
          onValidationChange={handleValidationChange}
          mixedFields={
            isMultiSelect
              ? Object.keys(formValue).filter((k) => formValue[k] === MIXED_SENTINEL)
              : undefined
          }
        />
      </div>
    );
  }

  return <p data-testid="property-grid-empty">Select a node</p>;
}

/**
 * Property grid panel bound to the current node selection.
 *
 * - Single selection: shows SchemaForm for the selected node's data
 * - Multi-select (same kind): computes common field values, shows "mixed"
 *   placeholder for differing fields, applies edits to all selected nodes
 * - Multi-select (different kinds): shows info message
 * - Shows error count badge when validation errors exist
 * - Reports validation state via `ValidationContext` for Toolbar integration
 * - Clears validation state when no form is active
 * - Shows "Select a node" empty state when nothing is selected
 */
export function PropertyGrid() {
  const lastSelectedNodeId = useWorkflowStore((s) => s.lastSelectedNodeId);
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds);
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const { errorCount, setValidation } = useValidation();

  // Find all selected nodes
  const selectedNodes = useMemo(() => {
    const idSet = new Set(selectedNodeIds);
    return nodes.filter((n) => idSet.has(n.id));
  }, [selectedNodeIds, nodes]);

  const isMultiSelect = selectedNodes.length > 1;

  // For multi-select: check if all selected nodes are the same kind
  const multiSelectKind = useMemo(() => {
    if (!isMultiSelect) return null;
    const kinds = new Set(selectedNodes.map((n) => n.kind));
    return kinds.size === 1 ? selectedNodes[0].kind : null;
  }, [isMultiSelect, selectedNodes]);

  // Single-select: resolve the primary node
  const node = useMemo(
    () => (lastSelectedNodeId ? nodes.find((n) => n.id === lastSelectedNodeId) : undefined),
    [lastSelectedNodeId, nodes],
  );

  const spec = useWorkflowStore((s) => {
    if (isMultiSelect && multiSelectKind) {
      return selectNodeSpec(s, multiSelectKind);
    }
    return node ? selectNodeSpec(s, node.kind) : undefined;
  });

  // Compute the value to display in the form
  const formValue = useMemo(() => {
    if (isMultiSelect && multiSelectKind && selectedNodes.length > 0) {
      const dataList = selectedNodes.map((n) => n.data as Record<string, unknown>);
      return computeCommonValues(dataList);
    }
    return node?.data as Record<string, unknown> | undefined;
  }, [isMultiSelect, multiSelectKind, selectedNodes, node]);

  const hasActiveForm = Boolean(spec && formValue);

  // Clear validation state when the form is not active (no node selected, unmount, etc.)
  useEffect(() => {
    if (!hasActiveForm) {
      setValidation(0, []);
    }
  }, [hasActiveForm, setValidation]);

  // Commit function that applies the value to the store
  const commitChange = useCallback(
    (value: Record<string, unknown>) => {
      if (isMultiSelect && multiSelectKind) {
        // Only apply fields that are not mixed
        for (const selectedNode of selectedNodes) {
          const currentData = selectedNode.data as Record<string, unknown>;
          const merged: Record<string, unknown> = { ...currentData };
          for (const [key, val] of Object.entries(value)) {
            if (val !== MIXED_SENTINEL) {
              merged[key] = val;
            }
          }
          updateNodeData(selectedNode.id, merged);
        }
      } else if (node) {
        updateNodeData(node.id, value);
      }
    },
    [isMultiSelect, multiSelectKind, selectedNodes, node, updateNodeData],
  );

  // Debounced commit: stages changes and commits after 300ms of inactivity
  const { stage: handleChange } = useDebouncedCommit<Record<string, unknown>>({
    onCommit: commitChange,
    delay: 300,
  });

  const handleLabelChange = useCallback(
    (newLabel: string) => {
      if (isMultiSelect && multiSelectKind) {
        for (const selectedNode of selectedNodes) {
          const current = selectedNode.data as Record<string, unknown>;
          updateNodeData(selectedNode.id, { ...current, name: newLabel });
        }
      } else if (node) {
        const current = node.data as Record<string, unknown>;
        updateNodeData(node.id, { ...current, name: newLabel });
      }
    },
    [isMultiSelect, multiSelectKind, selectedNodes, node, updateNodeData],
  );

  const handleValidationChange = useCallback(
    (count: number, messages: string[]) => {
      setValidation(count, messages);
    },
    [setValidation],
  );

  // Derive label for header
  const nodeLabel = useMemo(() => {
    if (isMultiSelect && multiSelectKind && formValue) {
      const name = formValue.name;
      if (name === MIXED_SENTINEL) return undefined;
      return typeof name === "string" ? name : undefined;
    }
    return formValue && typeof formValue.name === "string" ? formValue.name : undefined;
  }, [isMultiSelect, multiSelectKind, formValue]);

  // Header info
  const headerKind = isMultiSelect && multiSelectKind ? multiSelectKind : node?.kind;
  const headerId = isMultiSelect ? `${String(selectedNodes.length)} nodes` : (node?.id ?? "");

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
      <PropertyGridContent
        isMultiSelect={isMultiSelect}
        multiSelectKind={multiSelectKind}
        hasActiveForm={hasActiveForm}
        spec={spec}
        formValue={formValue}
        selectedNodes={selectedNodes}
        headerKind={headerKind ?? ""}
        headerId={headerId}
        nodeLabel={nodeLabel}
        handleLabelChange={handleLabelChange}
        handleChange={handleChange}
        handleValidationChange={handleValidationChange}
      />
    </div>
  );
}
