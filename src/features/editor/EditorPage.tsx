import { ReactFlowProvider } from "@xyflow/react";
import { EditorLayout } from "@/features/editor/EditorLayout";

export function EditorPage() {
  return (
    <ReactFlowProvider>
      <div style={{ width: "100vw", height: "100vh" }}>
        <EditorLayout />
      </div>
    </ReactFlowProvider>
  );
}
