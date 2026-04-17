/** Port interface for emitting telemetry events. */
export interface ITelemetrySink {
  /** Track a named event with optional properties. */
  track(name: string, properties?: Record<string, unknown>): void;
}
