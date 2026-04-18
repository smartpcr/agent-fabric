import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunControls } from "@/features/execution/runControls";
import { ExecutionProvider } from "@/providers/ExecutionProvider";
import type { IExecutionCommandSink } from "@/ports/IExecutionCommandSink";
import type { IExecutionEventSource } from "@/ports/IExecutionEventSource";
import type { RunStatus } from "@/store/slices/executionSlice";

/** Stub event source (not exercised in these tests). */
function stubEventSource(): IExecutionEventSource {
  return {
    subscribe: vi.fn(() => vi.fn()),
    close: vi.fn(),
    connectionState$: {
      subscribe: vi.fn(() => vi.fn()),
      current: vi.fn(() => "connected" as const),
    },
  };
}

/** Build a mock command sink that tracks calls via sendSpy. */
function createMockSinkPair() {
  const sendSpy = vi.fn().mockResolvedValue(undefined);
  const commandSink: IExecutionCommandSink = { send: sendSpy };
  return { commandSink, sendSpy };
}

/** Render RunControls wrapped in ExecutionProvider. */
function renderControls(runStatus: RunStatus | undefined) {
  const { commandSink, sendSpy } = createMockSinkPair();
  const eventSource = stubEventSource();
  const result = render(
    <ExecutionProvider eventSource={eventSource} commandSink={commandSink}>
      <RunControls runStatus={runStatus} />
    </ExecutionProvider>,
  );
  return { ...result, sendSpy };
}

afterEach(() => {
  cleanup();
});

describe("RunControls", () => {
  // ── Rendering ───────────────────────────────────────────────────

  it("renders all three control buttons", () => {
    renderControls(undefined);
    expect(screen.getByTestId("run-btn")).toBeInTheDocument();
    expect(screen.getByTestId("pause-btn")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-btn")).toBeInTheDocument();
  });

  it("has role='toolbar' and aria-label", () => {
    renderControls(undefined);
    const toolbar = screen.getByTestId("run-controls");
    expect(toolbar).toHaveAttribute("role", "toolbar");
    expect(toolbar).toHaveAttribute("aria-label", "Run controls");
  });

  // ── Disabled states: no active run ──────────────────────────────

  it("Start is enabled when no run is active", () => {
    renderControls(undefined);
    expect(screen.getByTestId("run-btn")).not.toBeDisabled();
  });

  it("Pause is disabled when no run is active", () => {
    renderControls(undefined);
    expect(screen.getByTestId("pause-btn")).toBeDisabled();
  });

  it("Cancel is disabled when no run is active", () => {
    renderControls(undefined);
    expect(screen.getByTestId("cancel-btn")).toBeDisabled();
  });

  // ── Disabled states: running ────────────────────────────────────

  it("Start is disabled when run is running", () => {
    renderControls("running");
    expect(screen.getByTestId("run-btn")).toBeDisabled();
  });

  it("Pause is enabled when run is running", () => {
    renderControls("running");
    expect(screen.getByTestId("pause-btn")).not.toBeDisabled();
  });

  it("Cancel is enabled when run is running", () => {
    renderControls("running");
    expect(screen.getByTestId("cancel-btn")).not.toBeDisabled();
  });

  // ── Disabled states: completed ──────────────────────────────────

  it("Start is enabled when run is completed", () => {
    renderControls("completed");
    expect(screen.getByTestId("run-btn")).not.toBeDisabled();
  });

  it("Pause is disabled when run is completed", () => {
    renderControls("completed");
    expect(screen.getByTestId("pause-btn")).toBeDisabled();
  });

  it("Cancel is disabled when run is completed", () => {
    renderControls("completed");
    expect(screen.getByTestId("cancel-btn")).toBeDisabled();
  });

  // ── Disabled states: failed ─────────────────────────────────────

  it("Start is enabled when run failed", () => {
    renderControls("failed");
    expect(screen.getByTestId("run-btn")).not.toBeDisabled();
  });

  it("Pause is disabled when run failed", () => {
    renderControls("failed");
    expect(screen.getByTestId("pause-btn")).toBeDisabled();
  });

  // ── Disabled states: cancelled ──────────────────────────────────

  it("Start is enabled when run is cancelled", () => {
    renderControls("cancelled");
    expect(screen.getByTestId("run-btn")).not.toBeDisabled();
  });

  it("Pause is disabled when run is cancelled", () => {
    renderControls("cancelled");
    expect(screen.getByTestId("pause-btn")).toBeDisabled();
  });

  // ── Command dispatch ────────────────────────────────────────────

  it("clicking Start dispatches { type: 'run' }", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls(undefined);

    await user.click(screen.getByTestId("run-btn"));

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({ type: "run" });
  });

  it("clicking Pause dispatches { type: 'pause' }", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls("running");

    await user.click(screen.getByTestId("pause-btn"));

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({ type: "pause" });
  });

  it("clicking Cancel dispatches { type: 'cancel' }", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls("running");

    await user.click(screen.getByTestId("cancel-btn"));

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({ type: "cancel" });
  });

  it("clicking disabled Start does not dispatch", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls("running");

    await user.click(screen.getByTestId("run-btn"));

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("clicking disabled Pause does not dispatch", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls("completed");

    await user.click(screen.getByTestId("pause-btn"));

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("clicking disabled Cancel does not dispatch", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls("completed");

    await user.click(screen.getByTestId("cancel-btn"));

    expect(sendSpy).not.toHaveBeenCalled();
  });

  // ── Keyboard shortcuts ──────────────────────────────────────────

  it("Ctrl+R dispatches run command when not running", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls(undefined);

    await user.keyboard("{Control>}r{/Control}");

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({ type: "run" });
  });

  it("Ctrl+R does not dispatch when already running", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls("running");

    await user.keyboard("{Control>}r{/Control}");

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("Ctrl+. dispatches cancel command when running", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls("running");

    await user.keyboard("{Control>}.{/Control}");

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith({ type: "cancel" });
  });

  it("Ctrl+. does not dispatch when not running", async () => {
    const user = userEvent.setup();
    const { sendSpy } = renderControls(undefined);

    await user.keyboard("{Control>}.{/Control}");

    expect(sendSpy).not.toHaveBeenCalled();
  });

  // ── Accessible labels ───────────────────────────────────────────

  it("buttons have accessible labels", () => {
    renderControls(undefined);
    expect(screen.getByTestId("run-btn")).toHaveAttribute("aria-label", "Start run");
    expect(screen.getByTestId("pause-btn")).toHaveAttribute("aria-label", "Pause run");
    expect(screen.getByTestId("cancel-btn")).toHaveAttribute("aria-label", "Cancel run");
  });
});
