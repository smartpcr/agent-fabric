import type { ReactNode } from "react";
import type { IWorkflowRepository } from "@/ports/IWorkflowRepository";
import type { IExecutionEventSource } from "@/ports/IExecutionEventSource";
import type { IExecutionCommandSink } from "@/ports/IExecutionCommandSink";
import type { ITelemetrySink } from "@/ports/ITelemetrySink";
import { RepositoryProvider } from "@/providers/RepositoryProvider";
import { ExecutionProvider } from "@/providers/ExecutionProvider";
import { TelemetryProvider } from "@/providers/TelemetryProvider";
import { NoopTelemetrySink } from "@/adapters/NoopTelemetrySink";

const defaultTelemetry = new NoopTelemetrySink();

export function WorkflowProviders({
  repository,
  eventSource,
  commandSink,
  telemetry = defaultTelemetry,
  children,
}: {
  repository: IWorkflowRepository;
  eventSource: IExecutionEventSource;
  commandSink: IExecutionCommandSink;
  telemetry?: ITelemetrySink;
  children: ReactNode;
}) {
  return (
    <RepositoryProvider repository={repository}>
      <ExecutionProvider eventSource={eventSource} commandSink={commandSink}>
        <TelemetryProvider sink={telemetry}>{children}</TelemetryProvider>
      </ExecutionProvider>
    </RepositoryProvider>
  );
}
