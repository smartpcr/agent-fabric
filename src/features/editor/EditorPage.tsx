import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "@/features/canvas/Canvas";

export function EditorPage() {
  return (
    <ReactFlowProvider>
      <div style={{ width: "100vw", height: "100vh" }}>
        <Canvas />
      </div>
    </ReactFlowProvider>
  );
}
