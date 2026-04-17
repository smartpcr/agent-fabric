export type NodeExecutionState =
  | { readonly status: "pending" }
  | {
      readonly status: "running";
      readonly startedAt: number;
      readonly iteration?: number;
    }
  | {
      readonly status: "success";
      readonly finishedAt: number;
      readonly result?: unknown;
    }
  | {
      readonly status: "error";
      readonly finishedAt: number;
      readonly error: string;
    }
  | { readonly status: "skipped" };

export type EdgeExecutionState =
  | { readonly status: "pending" }
  | { readonly status: "active"; readonly activatedAt: number }
  | { readonly status: "completed"; readonly completedAt: number }
  | { readonly status: "skipped" };

// Node execution state factories

export function pendingNode(): NodeExecutionState {
  return { status: "pending" };
}

export function runningNode(startedAt: number, iteration?: number): NodeExecutionState {
  if (iteration === undefined) {
    return { status: "running", startedAt };
  }
  return { status: "running", startedAt, iteration };
}

export function successNode(finishedAt: number, result?: unknown): NodeExecutionState {
  if (result === undefined) {
    return { status: "success", finishedAt };
  }
  return { status: "success", finishedAt, result };
}

export function errorNode(finishedAt: number, error: string): NodeExecutionState {
  return { status: "error", finishedAt, error };
}

export function skippedNode(): NodeExecutionState {
  return { status: "skipped" };
}

// Edge execution state factories

export function pendingEdge(): EdgeExecutionState {
  return { status: "pending" };
}

export function activeEdge(activatedAt: number): EdgeExecutionState {
  return { status: "active", activatedAt };
}

export function completedEdge(completedAt: number): EdgeExecutionState {
  return { status: "completed", completedAt };
}

export function skippedEdge(): EdgeExecutionState {
  return { status: "skipped" };
}
