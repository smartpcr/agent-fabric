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
