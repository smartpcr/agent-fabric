import { ReactFlowProvider } from "@xyflow/react";
import { EditorLayout } from "@/features/editor/EditorLayout";
import { DragProvider } from "@/features/palette/DragContext";
import { DragGhost } from "@/features/palette/DragGhost";

export function EditorPage() {
  return (
    <ReactFlowProvider>
      <DragProvider>
        <main style={{ width: "100vw", height: "100vh" }}>
          <h1
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              padding: 0,
              margin: "-1px",
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            Workflow Editor
          </h1>
          <EditorLayout />
        </main>
        <DragGhost />
      </DragProvider>
    </ReactFlowProvider>
  );
}
