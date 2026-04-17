import { ReactFlow, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Background } from "@/features/canvas/Background";

export function Canvas() {
  return (
    <div
      role="application"
      aria-label="Workflow Canvas"
      style={{ width: "100%", height: "100%" }}
    >
      <ReactFlow nodes={[]} edges={[]}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
