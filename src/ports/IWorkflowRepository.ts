/** Port interface for workflow persistence operations. */
export interface IWorkflowRepository {
  /** Load a workflow definition by id. */
  load(id: string): Promise<unknown>;
  /** Persist a workflow definition. */
  save(id: string, workflow: unknown): Promise<void>;
  /** List available workflow ids. */
  list(): Promise<string[]>;
}
