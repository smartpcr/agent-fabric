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
    const { NoopExecutionCommandSink } = await import("@/adapters/NoopExecutionCommandSink");
    const { ExecutionProvider } = await import("@/providers/ExecutionProvider");
    const { getStoreInstance } = await import("@/store/hooks");

    const fakeEventSource = new FakeExecutionEventSource();
    const noopCommandSink = new NoopExecutionCommandSink();
    const store = getStoreInstance();

    interface TestHarness {
      startRun: (runId: string) => void;
      emit: (event: unknown) => void;
      eventSource: InstanceType<typeof FakeExecutionEventSource>;
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
    };

    (window as unknown as { __TEST_HARNESS__: TestHarness }).__TEST_HARNESS__ = testHarness;

    createRoot(rootElement).render(
      <StrictMode>
        <ExecutionProvider eventSource={fakeEventSource} commandSink={noopCommandSink}>
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
