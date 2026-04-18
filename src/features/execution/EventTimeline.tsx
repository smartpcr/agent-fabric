import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExecutionEvent } from "@/domain/models/executionEvent";

/** A node-scoped execution event (events with a `nodeId` field). */
export type NodeExecutionEvent = ExecutionEvent & { nodeId: string };

/** Default clipboard writer using the Clipboard API. */
async function defaultCopyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export interface EventTimelineProps {
  /** Events to display, scoped to a specific `(runId, nodeId)`. */
  readonly events: readonly NodeExecutionEvent[];
  /** Optional override for clipboard copy (useful for testing). */
  readonly onCopy?: (text: string) => Promise<void>;
}

/** Format a timestamp as HH:MM:SS.mmm. */
function formatTimestamp(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

/** Format a payload object as pretty-printed JSON. */
function formatPayload(payload: unknown): string {
  if (payload === undefined || payload === null) {
    return "";
  }
  return JSON.stringify(payload, null, 2);
}

/**
 * Chronologically ordered event timeline for a specific `(runId, nodeId)`.
 *
 * Renders each event with its type, timestamp, and payload pretty-printed
 * in a `<pre>` block. Each event's payload is copyable to the clipboard.
 */
export function EventTimeline({ events, onCopy }: EventTimelineProps) {
  const { t } = useTranslation();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyFn = onCopy ?? defaultCopyToClipboard;

  // Sort events chronologically by `at` timestamp
  const sorted = [...events].sort((a, b) => a.at - b.at);

  const handleCopy = useCallback(
    async (payload: unknown, index: number) => {
      const text = formatPayload(payload);
      if (text === "") {
        return;
      }
      await copyFn(text);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current));
      }, 2000);
    },
    [copyFn],
  );

  if (sorted.length === 0) {
    return (
      <div data-testid="event-timeline-empty" style={{ color: "#94a3b8", fontStyle: "italic" }}>
        {t("execution.noEvents")}
      </div>
    );
  }

  return (
    <ol
      data-testid="event-timeline"
      aria-label={t("execution.eventTimeline")}
      style={{ listStyle: "none", padding: 0, margin: 0 }}
    >
      {sorted.map((event, idx) => {
        const payloadText = formatPayload(
          "payload" in event ? (event as { payload?: unknown }).payload : undefined,
        );
        const hasPayload = payloadText !== "";

        return (
          <li
            key={`${event.type}-${String(event.at)}-${String(idx)}`}
            data-testid="event-timeline-item"
            style={{
              padding: "8px 0",
              borderBottom: "1px solid var(--color-border, #e2e8f0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span data-testid="event-type" style={{ fontWeight: 600, fontSize: 13 }}>
                {event.type}
              </span>
              <span
                data-testid="event-timestamp"
                style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}
              >
                {formatTimestamp(event.at)}
              </span>
            </div>
            {hasPayload ? (
              <div style={{ position: "relative" }}>
                <pre
                  data-testid="event-payload"
                  style={{
                    background: "var(--color-code-bg, #f1f5f9)",
                    padding: "8px 12px",
                    borderRadius: 4,
                    fontSize: 12,
                    overflow: "auto",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {payloadText}
                </pre>
                <button
                  data-testid="event-copy-btn"
                  aria-label={t("execution.copyPayload", { type: event.type })}
                  onClick={() => {
                    void handleCopy((event as { payload?: unknown }).payload, idx);
                  }}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "var(--color-bg, #fff)",
                    border: "1px solid var(--color-border, #e2e8f0)",
                    borderRadius: 4,
                    cursor: "pointer",
                    padding: "2px 6px",
                    fontSize: 11,
                  }}
                >
                  {copiedIndex === idx ? t("execution.copied") : t("execution.copyAction")}
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
