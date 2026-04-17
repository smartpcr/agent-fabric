import { createContext, type ReactNode } from "react";
import type { ITelemetrySink } from "@/ports/ITelemetrySink";
import { NoopTelemetrySink } from "@/adapters/NoopTelemetrySink";

const defaultSink = new NoopTelemetrySink();

export const TelemetryContext = createContext<ITelemetrySink>(defaultSink);

export function TelemetryProvider({
  sink,
  children,
}: {
  sink: ITelemetrySink;
  children: ReactNode;
}) {
  return <TelemetryContext.Provider value={sink}>{children}</TelemetryContext.Provider>;
}
