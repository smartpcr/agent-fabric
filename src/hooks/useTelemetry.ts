import { useContext } from "react";
import { TelemetryContext } from "@/providers/TelemetryProvider";

export function useTelemetry() {
  return useContext(TelemetryContext);
}
