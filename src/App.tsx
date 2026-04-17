import { useEffect } from "react";
import { EditorPage } from "@/features/editor/EditorPage";
import { NodeRegistry } from "@/registry/NodeRegistry";
import { registerBuiltins } from "@/registry/registerBuiltins";
import { useWorkflowStore } from "@/store/hooks";

function useInitRegistry() {
  const setRegistry = useWorkflowStore((s) => s.setRegistry);
  const registrySize = useWorkflowStore((s) => s.registry.list().length);

  useEffect(() => {
    if (registrySize === 0) {
      const registry = new NodeRegistry();
      registerBuiltins(registry);
      setRegistry(registry);
    }
  }, [setRegistry, registrySize]);
}

export function App() {
  useInitRegistry();
  return <EditorPage />;
}
