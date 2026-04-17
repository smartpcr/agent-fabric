import type { NodeRegistry } from "@/registry/NodeRegistry";
import { StartNodeSpec } from "@/registry/builtins/StartNode.spec";
import { EndNodeSpec } from "@/registry/builtins/EndNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";

const builtins = [StartNodeSpec, EndNodeSpec, TaskNodeSpec] as const;

export function registerBuiltins(registry: NodeRegistry): void {
  for (const spec of builtins) {
    if (!registry.has(spec.kind)) {
      registry.register(spec);
    }
  }
}
