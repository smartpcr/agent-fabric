import { useContext } from "react";
import { ExecutionContext } from "@/providers/ExecutionProvider";

export function useExecutionEventSource() {
  const ctx = useContext(ExecutionContext);
  if (ctx === null) {
    throw new Error("useExecutionEventSource used outside of provider");
  }
  return ctx.eventSource;
}
