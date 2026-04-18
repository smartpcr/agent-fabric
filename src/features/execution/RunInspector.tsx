import { useCallback, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";

export interface RunInspectorProps {
  /** Whether the inspector panel is open. */
  readonly open: boolean;
  /** Callback invoked when the panel should close. */
  readonly onClose: () => void;
  /** Optional children to render inside the panel body. */
  readonly children?: React.ReactNode;
}

/**
 * Right-side slide-in inspector panel for viewing execution run details.
 *
 * Built on Radix Dialog for focus-trap and accessible dismiss (Escape key).
 * Opens on error badge click or from run controls.
 */
export function RunInspector({ open, onClose, children }: RunInspectorProps) {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onClose();
      }
    },
    [onClose],
  );

  // Focus the close button when opened so focus-trap starts inside the panel
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="run-inspector-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          data-testid="run-inspector"
          role="dialog"
          aria-label="Run Inspector"
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: 400,
            maxWidth: "100vw",
            backgroundColor: "var(--color-bg, #fff)",
            borderLeft: "1px solid var(--color-border, #e2e8f0)",
            boxShadow: "-4px 0 16px rgba(0, 0, 0, 0.1)",
            zIndex: 1001,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid var(--color-border, #e2e8f0)",
            }}
          >
            <Dialog.Title
              data-testid="run-inspector-title"
              style={{ margin: 0, fontSize: 16, fontWeight: 600 }}
            >
              {t("execution.runInspector")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                ref={closeButtonRef}
                data-testid="run-inspector-close"
                aria-label="Close inspector"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </Dialog.Close>
          </div>
          <div data-testid="run-inspector-body" style={{ flex: 1, overflow: "auto", padding: 16 }}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
