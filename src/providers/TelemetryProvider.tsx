import { createContext, type ReactNode } from "react";
import type { ITelemetrySink } from "@/ports/ITelemetrySink";

export const TelemetryContext = createContext<ITelemetrySink | null>(null);

export function TelemetryProvider({
  sink,
  children,
}: {
  sink: ITelemetrySink;
  children: ReactNode;
}) {
  return <TelemetryContext.Provider value={sink}>{children}</TelemetryContext.Provider>;
}
