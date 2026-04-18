import { useContext, useCallback } from "react";
import { ExecutionContext } from "@/providers/ExecutionProvider";
import type { IExecutionCommandSink } from "@/ports/IExecutionCommandSink";

/** Typed execution command discriminated union. */
export type ExecutionCommand = { type: "run" } | { type: "pause" } | { type: "cancel" };

/**
 * Hook that provides a typed `dispatch` function for sending execution
 * commands through the `IExecutionCommandSink` port.
 *
 * Throws if used outside of `ExecutionProvider`.
 */
export function useExecutionCommand(): {
  dispatch: (command: ExecutionCommand) => Promise<void>;
  commandSink: IExecutionCommandSink;
} {
  const ctx = useContext(ExecutionContext);
  if (ctx === null) {
    throw new Error("useExecutionCommand must be used within an ExecutionProvider");
  }

  const { commandSink } = ctx;

  const dispatch = useCallback(
    async (command: ExecutionCommand): Promise<void> => {
      const sink = ctx.commandSink;
      await sink.send(command);
    },
    [ctx],
  );

  return { dispatch, commandSink };
}
