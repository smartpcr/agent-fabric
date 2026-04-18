import type { NodeRegistry } from "@/registry/NodeRegistry";
import { StartNodeSpec } from "@/registry/builtins/StartNode.spec";
import { EndNodeSpec } from "@/registry/builtins/EndNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";
import { DecisionNodeSpec } from "@/registry/builtins/DecisionNode.spec";
import { DecisionSwitchNodeSpec } from "@/registry/builtins/DecisionSwitchNode.spec";

const builtins = [
  StartNodeSpec,
  EndNodeSpec,
  TaskNodeSpec,
  DecisionNodeSpec,
  DecisionSwitchNodeSpec,
] as const;

export function registerBuiltins(registry: NodeRegistry): void {
  for (const spec of builtins) {
    if (!registry.has(spec.kind)) {
      registry.register(spec);
    }
  }
}
