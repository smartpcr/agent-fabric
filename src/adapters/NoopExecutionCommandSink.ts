import type { IExecutionCommandSink } from "@/ports/IExecutionCommandSink";

/**
 * No-op command sink for development and testing.
 * All commands are silently ignored.
 */
export class NoopExecutionCommandSink implements IExecutionCommandSink {
  async send(_command: unknown): Promise<void> {
    // no-op
  }
}
