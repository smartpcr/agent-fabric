import { newId } from "@/utils/id";

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface WorkflowNode<TData = unknown> {
  readonly id: string;
  readonly kind: string;
  readonly position: Position;
  readonly data: TData;
}

interface MakeNodeOptions<TData = unknown> {
  kind: string;
  data: TData;
  position?: Position;
}

function validatePosition(pos: Position): void {
  if (!Number.isFinite(pos.x)) {
    throw new Error("Position x must be a finite number");
  }
  if (!Number.isFinite(pos.y)) {
    throw new Error("Position y must be a finite number");
  }
}

export function makeNode<TData = unknown>(options: MakeNodeOptions<TData>): WorkflowNode<TData> {
  const position = options.position ?? { x: 0, y: 0 };
  validatePosition(position);
  return Object.freeze({
    id: newId("node"),
    kind: options.kind,
    position: Object.freeze({ ...position }),
    data: options.data,
  });
}
