/** Port interface for dispatching execution commands. */
export interface IExecutionCommandSink {
  /** Send a command to the execution engine. */
  send(command: unknown): Promise<void>;
}
