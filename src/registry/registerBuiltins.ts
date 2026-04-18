import type { NodeRegistry } from "@/registry/NodeRegistry";
import { StartNodeSpec } from "@/registry/builtins/StartNode.spec";
import { EndNodeSpec } from "@/registry/builtins/EndNode.spec";
import { TaskNodeSpec } from "@/registry/builtins/TaskNode.spec";
import { DecisionNodeSpec } from "@/registry/builtins/DecisionNode.spec";
import { DecisionSwitchNodeSpec } from "@/registry/builtins/DecisionSwitchNode.spec";
import { LoopWhileNodeSpec } from "@/registry/builtins/LoopWhileNode.spec";
import { LoopForEachNodeSpec } from "@/registry/builtins/LoopForEachNode.spec";
import { introspect } from "@/features/property-grid/introspect";
import { registerSecretFieldsFromDescriptors } from "@/features/property-grid/fields/SecretField";

const builtins = [
  StartNodeSpec,
  EndNodeSpec,
  TaskNodeSpec,
  DecisionNodeSpec,
  DecisionSwitchNodeSpec,
  LoopWhileNodeSpec,
  LoopForEachNodeSpec,
] as const;

export function registerBuiltins(registry: NodeRegistry): void {
  for (const spec of builtins) {
    if (!registry.has(spec.kind)) {
      registry.register(spec);
    }
    // Deterministically register any secret fields from the spec's schema
    // so autosave scrubbing is guaranteed before any component mounts.
    const descriptors = introspect(spec.propertySchema);
    registerSecretFieldsFromDescriptors(descriptors);
  }
}
