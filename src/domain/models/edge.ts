import { newId } from "@/utils/id";

export type EdgeKind = "default" | "loop-back" | "conditional";

export interface WorkflowEdge {
  readonly id: string;
  readonly source: string;
  readonly sourcePort: string;
  readonly target: string;
  readonly targetPort: string;
  readonly label?: string;
  readonly condition?: string;
  readonly kind: EdgeKind;
  readonly selected?: boolean;
}

interface MakeEdgeOptions {
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
  label?: string;
  condition?: string;
  kind?: EdgeKind;
}

function validateRequired(value: string, name: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

export function makeEdge(options: MakeEdgeOptions): WorkflowEdge {
  validateRequired(options.source, "source");
  validateRequired(options.sourcePort, "sourcePort");
  validateRequired(options.target, "target");
  validateRequired(options.targetPort, "targetPort");

  const base: WorkflowEdge = {
    id: newId("edge"),
    source: options.source,
    sourcePort: options.sourcePort,
    target: options.target,
    targetPort: options.targetPort,
    kind: options.kind ?? "default",
  };

  if (options.label === undefined && options.condition === undefined) {
    return Object.freeze(base);
  }

  return Object.freeze({
    ...base,
    ...(options.label === undefined ? {} : { label: options.label }),
    ...(options.condition === undefined ? {} : { condition: options.condition }),
  });
}
