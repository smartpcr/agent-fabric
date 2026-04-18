import { createContext, useCallback, useState, type ReactNode } from "react";
import * as RadixToast from "@radix-ui/react-toast";
import i18next from "i18next";

export type ToastVariant = "default" | "success" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  actions?: ToastAction[];
}

export interface ToastContextValue {
  toasts: ToastMessage[];
  show: (opts: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    actions?: ToastAction[];
  }) => void;
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
    (opts: {
      title: string;
      description?: string;
      variant?: ToastVariant;
      actions?: ToastAction[];
    }) => {
      const id = `toast-${String(nextId)}`;
      nextId += 1;
      const toast: ToastMessage = {
        id,
        title: opts.title,
        ...(opts.description === undefined ? {} : { description: opts.description }),
        variant: opts.variant ?? "default",
        actions: opts.actions,
      };
      setToasts((prev) => [...prev, toast]);

      // Only auto-dismiss if no actions are present
      if (!opts.actions?.length) {
        setTimeout(() => {
          dismiss(id);
        }, AUTO_DISMISS_MS);
      }
    },
    [dismiss],
  );

  return (
    <RadixToast.Provider duration={AUTO_DISMISS_MS}>
      <ToastContext.Provider value={{ toasts, show, dismiss }}>
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            data-variant={toast.variant}
            open
            onOpenChange={() => {
              dismiss(toast.id);
            }}
            style={{
              padding: "12px 16px",
              background: "var(--color-bg, #333)",
              color: "var(--color-fg, #fff)",
              borderRadius: 6,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              listStyle: "none",
            }}
          >
            <RadixToast.Title>
              <strong>{toast.title}</strong>
            </RadixToast.Title>
            {toast.description ? (
              <RadixToast.Description>{toast.description}</RadixToast.Description>
            ) : null}
            {toast.actions?.length ? (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {toast.actions.map((action) => (
                  <RadixToast.Action key={action.label} altText={action.label} asChild>
                    <button
                      type="button"
                      onClick={() => {
                        action.onClick();
                        dismiss(toast.id);
                      }}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 4,
                        border: "1px solid currentColor",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      {action.label}
                    </button>
                  </RadixToast.Action>
                ))}
              </div>
            ) : null}
            <RadixToast.Close
              aria-label={i18next.t("toast.dismiss")}
              style={{
                marginLeft: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "inherit",
              }}
            >
              ✕
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 9999,
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        />
      </ToastContext.Provider>
    </RadixToast.Provider>
  );
}

export { ToastContext };
