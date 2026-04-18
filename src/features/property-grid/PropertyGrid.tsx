import { useWorkflowStore } from "@/store/hooks";

export function PropertyGrid() {
  const inspectorNodeId = useWorkflowStore((s) => s.inspectorNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);

  const node = inspectorNodeId ? nodes.find((n) => n.id === inspectorNodeId) : undefined;

  const data = node?.data as Record<string, unknown> | undefined;

  return (
    <div role="complementary" aria-label="Property Grid" style={{ height: "100%", padding: "8px" }}>
      <h2>Properties</h2>
      {node ? (
        <div data-testid="property-grid-fields">
          <div data-testid="property-grid-kind">
            <strong>Kind:</strong> {node.kind}
          </div>
          {data
            ? Object.entries(data).map(([key, value]) => (
                <div key={key} data-testid={`property-field-${key}`}>
                  <label>{key}:</label>{" "}
                  <span data-testid={`property-value-${key}`}>
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))
            : null}
        </div>
      ) : (
        <p data-testid="property-grid-empty">No node selected</p>
      )}
    </div>
  );
}
