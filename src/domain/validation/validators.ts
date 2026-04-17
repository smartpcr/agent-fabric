import type { WorkflowNode } from "@/domain/models/node";
import type { NodeSpec } from "@/domain/models/nodeSpec";

export interface ValidationError {
  readonly path: string;
  readonly message: string;
}

function formatPath(segments: (string | number)[]): string {
  let result = "";
  for (const segment of segments) {
    if (typeof segment === "number") {
      result += `[${String(segment)}]`;
    } else if (result.length === 0) {
      result = segment;
    } else {
      result += `.${segment}`;
    }
  }
  return result;
}

export function validateNodeData<TData>(
  node: WorkflowNode<TData>,
  spec: NodeSpec<TData>,
): ValidationError[] {
  const result = spec.propertySchema.safeParse(node.data);
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => ({
    path: formatPath(issue.path as (string | number)[]),
    message: issue.message,
  }));
}
