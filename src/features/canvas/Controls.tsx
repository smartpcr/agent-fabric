import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { ZoomIn, ZoomOut, Maximize, Lock, Unlock } from "lucide-react";
import { useWorkflowStore } from "@/store/hooks";

export function CanvasControls() {
  const interactive = useWorkflowStore((s) => s.interactive);
  const toggleInteractive = useWorkflowStore((s) => s.toggleInteractive);
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
    <div data-testid="canvas-controls" role="toolbar" aria-label="Canvas controls">
      <button
        type="button"
        data-testid="zoom-in"
        aria-label="Zoom in (+)"
        title="Zoom in (+)"
        onClick={handleZoomIn}
      >
        <ZoomIn size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="zoom-out"
        aria-label="Zoom out (-)"
        title="Zoom out (-)"
        onClick={handleZoomOut}
      >
        <ZoomOut size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="fit-view"
        aria-label="Fit view (f)"
        title="Fit view (f)"
        onClick={handleFitView}
      >
        <Maximize size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid="toggle-lock"
        aria-label={interactive ? "Lock canvas (l)" : "Unlock canvas (l)"}
        aria-pressed={!interactive}
        title={interactive ? "Lock canvas (l)" : "Unlock canvas (l)"}
        onClick={handleToggleLock}
      >
        {interactive ? (
          <Unlock size={14} aria-hidden="true" />
        ) : (
          <Lock size={14} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
