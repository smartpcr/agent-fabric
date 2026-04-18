import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { ZoomIn, ZoomOut, Maximize, Lock, Unlock, LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkflowStore } from "@/store/hooks";

export function CanvasControls() {
  const { t } = useTranslation();
  const interactive = useWorkflowStore((s) => s.interactive);
  const toggleInteractive = useWorkflowStore((s) => s.toggleInteractive);
  const layoutRunning = useWorkflowStore((s) => s.layoutRunning);
  const applyLayout = useWorkflowStore((s) => s.applyLayout);
  const applyNodeChanges = useWorkflowStore((s) => s.applyNodeChanges);
  const setZoom = useWorkflowStore((s) => s.setZoom);
  const setPan = useWorkflowStore((s) => s.setPan);
  const { zoomIn, zoomOut, fitView, getViewport } = useReactFlow();

  const handleZoomIn = useCallback(() => {
    void zoomIn();
    const vp = getViewport();
    setZoom(vp.zoom);
  }, [zoomIn, getViewport, setZoom]);

  const handleZoomOut = useCallback(() => {
    void zoomOut();
    const vp = getViewport();
    setZoom(vp.zoom);
  }, [zoomOut, getViewport, setZoom]);

  const handleFitView = useCallback(() => {
    void fitView();
    const vp = getViewport();
    setZoom(vp.zoom);
    setPan(vp.x, vp.y);
  }, [fitView, getViewport, setZoom, setPan]);

  const handleToggleLock = useCallback(() => {
    toggleInteractive();
  }, [toggleInteractive]);

  return (
    <div data-testid="canvas-controls" role="toolbar" aria-label={t("canvasControls.ariaLabel")}>
      <button
        type="button"
        data-testid="zoom-in"
        aria-label={t("canvasControls.zoomIn")}
        title={t("canvasControls.zoomIn")}
        onClick={handleZoomIn}
      >
        <ZoomIn size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="zoom-out"
        aria-label={t("canvasControls.zoomOut")}
        title={t("canvasControls.zoomOut")}
        onClick={handleZoomOut}
      >
        <ZoomOut size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="fit-view"
        aria-label={t("canvasControls.fitView")}
        title={t("canvasControls.fitView")}
        onClick={handleFitView}
      >
        <Maximize size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="toggle-lock"
        aria-label={interactive ? t("canvasControls.lockCanvas") : t("canvasControls.unlockCanvas")}
        aria-pressed={!interactive}
        title={interactive ? t("canvasControls.lockCanvas") : t("canvasControls.unlockCanvas")}
        onClick={handleToggleLock}
      >
        {interactive ? (
          <Unlock size={14} aria-hidden="true" />
        ) : (
          <Lock size={14} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        data-testid="auto-layout-button"
        aria-label={t("toolbar.autoLayout")}
        title={t("toolbar.autoLayout")}
        disabled={layoutRunning}
        onClick={() => {
          // Read actual rendered node dimensions from the DOM before running
          // ELK layout so it uses real sizes instead of defaults.
          const vp = getViewport();
          const nodeEls = document.querySelectorAll<HTMLElement>(".react-flow__node[data-id]");
          const dimChanges: Array<{
            type: "dimensions";
            id: string;
            dimensions: { width: number; height: number };
          }> = [];
          for (const el of nodeEls) {
            const id = el.getAttribute("data-id");
            if (id) {
              // getBoundingClientRect includes zoom; divide to get flow coords
              const rect = el.getBoundingClientRect();
              dimChanges.push({
                type: "dimensions" as const,
                id,
                dimensions: {
                  width: Math.round(rect.width / vp.zoom),
                  height: Math.round(rect.height / vp.zoom),
                },
              });
            }
          }
          if (dimChanges.length > 0) {
            applyNodeChanges(dimChanges);
          }
          void applyLayout();
        }}
      >
        <LayoutGrid size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
