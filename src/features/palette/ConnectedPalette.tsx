import { Palette } from "@/features/palette/Palette";
import { useViewportCenter } from "@/features/palette/useViewportCenter";

/**
 * Production wrapper that connects Palette to the ReactFlow viewport.
 * Computes viewport center via `useReactFlow().getViewport()` and
 * passes it to Palette for keyboard insertion positioning.
 */
export function ConnectedPalette() {
  const getViewportCenter = useViewportCenter();
  return <Palette getViewportCenter={getViewportCenter} />;
}
