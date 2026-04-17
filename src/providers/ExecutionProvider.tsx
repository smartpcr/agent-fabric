import { createContext, type ReactNode } from "react";
import type { IExecutionEventSource } from "@/ports/IExecutionEventSource";
import type { IExecutionCommandSink } from "@/ports/IExecutionCommandSink";

export interface ExecutionContextValue {
  eventSource: IExecutionEventSource;
  commandSink: IExecutionCommandSink;
}

export const ExecutionContext = createContext<ExecutionContextValue | null>(null);

export function ExecutionProvider({
  eventSource,
  commandSink,
  children,
}: {
  eventSource: IExecutionEventSource;
  commandSink: IExecutionCommandSink;
  children: ReactNode;
}) {
  return (
    <ExecutionContext.Provider value={{ eventSource, commandSink }}>
      {children}
    </ExecutionContext.Provider>
  );
}
