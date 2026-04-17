import { Background as XYBackground, BackgroundVariant } from "@xyflow/react";
import { useWorkflowStore } from "@/store/hooks";

export function Background() {
  const snapEnabled = useWorkflowStore((s) => s.snapEnabled);
  const snapGridSize = useWorkflowStore((s) => s.snapGridSize);
  const variant = snapEnabled ? BackgroundVariant.Lines : BackgroundVariant.Dots;

  return <XYBackground variant={variant} gap={snapGridSize} />;
}
