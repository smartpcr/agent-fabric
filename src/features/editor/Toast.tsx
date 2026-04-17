import { createContext, useCallback, useState, type ReactNode } from "react";

export type ToastVariant = "default" | "success" | "error";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export interface ToastContextValue {
  toasts: ToastMessage[];
  show: (opts: { title: string; description?: string; variant?: ToastVariant }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (opts: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = `toast-${String(nextId)}`;
      nextId += 1;
      const toast: ToastMessage = {
        id,
        title: opts.title,
        ...(opts.description === undefined ? {} : { description: opts.description }),
        variant: opts.variant ?? "default",
      };
      setToasts((prev) => [...prev, toast]);

      setTimeout(() => {
        dismiss(id);
      }, AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, show, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 9999,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          data-variant={toast.variant}
          style={{
            padding: "12px 16px",
            background: "var(--color-bg, #333)",
            color: "var(--color-fg, #fff)",
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <strong>{toast.title}</strong>
          {toast.description ? <p>{toast.description}</p> : null}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              onDismiss(toast.id);
            }}
            style={{
              marginLeft: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export { ToastContext };
