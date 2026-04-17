import { ReactFlowProvider } from "@xyflow/react";
import { EditorLayout } from "@/features/editor/EditorLayout";
import { DragProvider } from "@/features/palette/DragContext";
import { DragGhost } from "@/features/palette/DragGhost";

export function EditorPage() {
  return (
    <ReactFlowProvider>
      <DragProvider>
        <div style={{ width: "100vw", height: "100vh" }}>
          <EditorLayout />
        </div>
        <DragGhost />
      </DragProvider>
    </ReactFlowProvider>
  );
}
