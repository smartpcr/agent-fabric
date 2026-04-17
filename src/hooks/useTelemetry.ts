import { useContext } from "react";
import { TelemetryContext } from "@/providers/TelemetryProvider";

export function useTelemetry() {
  const ctx = useContext(TelemetryContext);
  if (ctx === null) {
    throw new Error("useTelemetry used outside of provider");
  }
  return ctx;
}
