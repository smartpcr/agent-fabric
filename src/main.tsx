import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/tokens.css";
import "@/styles/tailwind.css";
import { App } from "@/App";
import { ExecutionProvider } from "@/providers/ExecutionProvider";
import { FakeExecutionEventSource } from "@/adapters/FakeExecutionEventSource";
import { NoopExecutionCommandSink } from "@/adapters/NoopExecutionCommandSink";
import { getStoreInstance } from "@/store/hooks";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const fakeEventSource = new FakeExecutionEventSource();
const noopCommandSink = new NoopExecutionCommandSink();

// Bridge: subscribe to all events on the fake source and apply them to the store.
// Uses a wildcard-like approach: we subscribe per-run when startRun is called.
const store = getStoreInstance();

/**
 * E2E test harness exposed on `window.__TEST_HARNESS__`.
 *
 * Playwright tests can:
 * - `startRun(runId)` to initialize a run in the store and subscribe to events.
 * - `emit(event)` to push events through the FakeExecutionEventSource → store pipeline.
 */
const testHarness = {
  startRun(runId: string) {
    store.getState().startRun(runId);
    fakeEventSource.subscribe(runId, (event: ExecutionEvent) => {
      store.getState().applyExecutionEvent(event);
    });
  },
  emit(event: ExecutionEvent) {
    fakeEventSource.emit(event);
  },
  eventSource: fakeEventSource,
};

// Expose test harness on window for Playwright E2E tests.
interface TestHarnessWindow extends Window {
  __TEST_HARNESS__: typeof testHarness;
}
(window as unknown as TestHarnessWindow).__TEST_HARNESS__ = testHarness;

createRoot(rootElement).render(
  <StrictMode>
    <ExecutionProvider eventSource={fakeEventSource} commandSink={noopCommandSink}>
      <App />
    </ExecutionProvider>
  </StrictMode>,
);
