import type { ITelemetrySink } from "@/ports/ITelemetrySink";

/** No-op telemetry sink — swallows all events silently. */
export class NoopTelemetrySink implements ITelemetrySink {
  track(_name: string, _properties?: Record<string, unknown>): void {
    return undefined;
  }
}
