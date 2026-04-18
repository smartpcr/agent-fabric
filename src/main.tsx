import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/tokens.css";
import "@/styles/tailwind.css";
import { App } from "@/App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

/**
 * When VITE_E2E_TEST_HARNESS is set, wire the app with FakeExecutionEventSource
 * and expose a test harness on `window.__TEST_HARNESS__` for Playwright E2E tests.
 * In normal runtime, the app renders without the execution provider and harness.
 */
async function bootstrap() {
  const envFlag = (import.meta.env as Record<string, string | undefined>).VITE_E2E_TEST_HARNESS;
  if (envFlag === "true") {
    const { FakeExecutionEventSource } = await import("@/adapters/FakeExecutionEventSource");
    const { ExecutionProvider } = await import("@/providers/ExecutionProvider");
    const { getStoreInstance } = await import("@/store/hooks");

    const fakeEventSource = new FakeExecutionEventSource();
    const store = getStoreInstance();

    // Auto-incrementing run ID for keyboard-initiated runs
    let runCounter = 0;

    /**
     * E2E command sink: when the UI dispatches a "run" command (e.g. via
     * the Start button or Ctrl+R), actually start a run in the store so
     * the keyboard-driven flow is fully wired end-to-end.
     */
    const testCommandSink = {
      send(command: unknown): Promise<void> {
        const cmd = command as { type: string };
        if (cmd.type === "run") {
          runCounter += 1;
          const runId = `e2e-auto-${String(runCounter)}`;
          store.getState().startRun(runId);
          fakeEventSource.subscribe(runId, (event) => {
            store.getState().applyExecutionEvent(event);
          });
        }
        return Promise.resolve();
      },
    };

    interface TestHarness {
      startRun: (runId: string) => void;
      emit: (event: unknown) => void;
      eventSource: InstanceType<typeof FakeExecutionEventSource>;
      /** Returns the most recently auto-generated run ID (from keyboard Start). */
      getLastAutoRunId: () => string | null;
    }

    const testHarness: TestHarness = {
      startRun(runId: string) {
        store.getState().startRun(runId);
        fakeEventSource.subscribe(runId, (event) => {
          store.getState().applyExecutionEvent(event);
        });
      },
      emit(event: unknown) {
        // FakeExecutionEventSource.emit accepts ExecutionEvent; cast from unknown
        // since Playwright passes a plain object from page.evaluate.
        fakeEventSource.emit(event as Parameters<typeof fakeEventSource.emit>[0]);
      },
      eventSource: fakeEventSource,
      getLastAutoRunId() {
        return runCounter > 0 ? `e2e-auto-${String(runCounter)}` : null;
      },
    };

    (window as unknown as { __TEST_HARNESS__: TestHarness }).__TEST_HARNESS__ = testHarness;

    createRoot(rootElement).render(
      <StrictMode>
        <ExecutionProvider eventSource={fakeEventSource} commandSink={testCommandSink}>
          <App />
        </ExecutionProvider>
      </StrictMode>,
    );
  } else {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}

void bootstrap();
