import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { IWorkflowRepository } from "@/ports/IWorkflowRepository";
import type { IExecutionEventSource } from "@/ports/IExecutionEventSource";
import type { IExecutionCommandSink } from "@/ports/IExecutionCommandSink";
import type { ITelemetrySink } from "@/ports/ITelemetrySink";
import { NoopTelemetrySink } from "@/adapters/NoopTelemetrySink";
import { RepositoryProvider } from "@/providers/RepositoryProvider";
import { ExecutionProvider } from "@/providers/ExecutionProvider";
import { TelemetryProvider } from "@/providers/TelemetryProvider";
import { WorkflowProviders } from "@/providers/WorkflowProviders";
import { useWorkflowRepo } from "@/hooks/useWorkflowRepo";
import { useExecutionEventSource } from "@/hooks/useExecutionEventSource";
import { useTelemetry } from "@/hooks/useTelemetry";

// ── Stub implementations ──────────────────────────────────────────

function stubRepo(): IWorkflowRepository {
  return {
    get: vi.fn().mockResolvedValue({ ok: true, value: { graph: {}, etag: "etag-1" } }),
    save: vi.fn().mockResolvedValue({ ok: true, value: { id: "w-1", etag: "etag-2" } }),
    create: vi.fn().mockResolvedValue({ ok: true, value: { id: "w-1", etag: "etag-1" } }),
    list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  };
}

function stubEventSource(): IExecutionEventSource {
  return {
    subscribe: vi.fn().mockReturnValue(() => undefined),
    connectionState$: {
      subscribe: vi.fn().mockReturnValue(() => undefined),
      current: () => "connected" as const,
    },
    close: vi.fn(),
  };
}

function stubCommandSink(): IExecutionCommandSink {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

// ── useWorkflowRepo ───────────────────────────────────────────────

describe("useWorkflowRepo", () => {
  it("throws when used outside of RepositoryProvider", () => {
    // Suppress React error boundary console noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useWorkflowRepo())).toThrow(
      "useWorkflowRepo used outside of provider",
    );
    spy.mockRestore();
  });

  it("returns wrapped methods inside RepositoryProvider", () => {
    const repo = stubRepo();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RepositoryProvider repository={repo}>{children}</RepositoryProvider>
    );
    const { result } = renderHook(() => useWorkflowRepo(), { wrapper });
    expect(result.current).toHaveProperty("load");
    expect(result.current).toHaveProperty("save");
    expect(result.current).toHaveProperty("create");
    expect(result.current).toHaveProperty("list");
  });
});

// ── useExecutionEventSource ───────────────────────────────────────

describe("useExecutionEventSource", () => {
  it("throws when used outside of ExecutionProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useExecutionEventSource())).toThrow(
      "useExecutionEventSource used outside of provider",
    );
    spy.mockRestore();
  });

  it("returns the injected event source inside ExecutionProvider", () => {
    const es = stubEventSource();
    const cs = stubCommandSink();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ExecutionProvider eventSource={es} commandSink={cs}>
        {children}
      </ExecutionProvider>
    );
    const { result } = renderHook(() => useExecutionEventSource(), { wrapper });
    expect(result.current).toBe(es);
  });
});

// ── useTelemetry ──────────────────────────────────────────────────

describe("useTelemetry", () => {
  it("throws when used outside of TelemetryProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useTelemetry())).toThrow("useTelemetry used outside of provider");
    spy.mockRestore();
  });

  it("returns the injected sink inside TelemetryProvider", () => {
    const custom: ITelemetrySink = { track: vi.fn() };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TelemetryProvider sink={custom}>{children}</TelemetryProvider>
    );
    const { result } = renderHook(() => useTelemetry(), { wrapper });
    expect(result.current).toBe(custom);
  });
});

// ── NoopTelemetrySink ─────────────────────────────────────────────

describe("NoopTelemetrySink", () => {
  it("track() is callable and does nothing", () => {
    const sink = new NoopTelemetrySink();
    expect(() => {
      sink.track("event");
    }).not.toThrow();
  });

  it("track() can be spied on", () => {
    const sink = new NoopTelemetrySink();
    const spy = vi.spyOn(sink, "track");
    sink.track("click", { target: "button" });
    expect(spy).toHaveBeenCalledWith("click", { target: "button" });
  });
});

// ── WorkflowProviders (composite) ─────────────────────────────────

describe("WorkflowProviders", () => {
  it("provides all contexts to children", () => {
    const repo = stubRepo();
    const es = stubEventSource();
    const cs = stubCommandSink();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkflowProviders repository={repo} eventSource={es} commandSink={cs}>
        {children}
      </WorkflowProviders>
    );
    const { result: repoResult } = renderHook(() => useWorkflowRepo(), {
      wrapper,
    });
    const { result: esResult } = renderHook(() => useExecutionEventSource(), {
      wrapper,
    });
    const { result: telResult } = renderHook(() => useTelemetry(), {
      wrapper,
    });
    expect(repoResult.current).toHaveProperty("load");
    expect(repoResult.current).toHaveProperty("save");
    expect(esResult.current).toBe(es);
    expect(telResult.current).toBeInstanceOf(NoopTelemetrySink);
  });

  it("accepts a custom telemetry sink", () => {
    const repo = stubRepo();
    const es = stubEventSource();
    const cs = stubCommandSink();
    const custom: ITelemetrySink = { track: vi.fn() };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkflowProviders repository={repo} eventSource={es} commandSink={cs} telemetry={custom}>
        {children}
      </WorkflowProviders>
    );
    const { result } = renderHook(() => useTelemetry(), { wrapper });
    expect(result.current).toBe(custom);
  });
});
