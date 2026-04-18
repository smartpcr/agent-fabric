import { z } from "zod";
import { makeInputPort, makeOutputPort, type PortSpec } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const branchSchema = z.object({
  label: z.string().min(1),
  condition: z.string().min(1),
});

const decisionSwitchPropertySchema = z.object({
  branches: z.array(branchSchema).min(1),
});

export { branchSchema, decisionSwitchPropertySchema };

type DecisionSwitchData = z.infer<typeof decisionSwitchPropertySchema>;

/**
 * Build ports for a switch-style decision node from its branch data.
 * Always includes 1 input port + N branch output ports + 1 implicit `default` port.
 */
export function buildSwitchPorts(
  branches: ReadonlyArray<{ label: string; condition: string }>,
): readonly PortSpec[] {
  const ports: PortSpec[] = [makeInputPort({ id: "in", label: "In", dataType: "any" })];

  for (const branch of branches) {
    ports.push(
      makeOutputPort({
        id: `branch-${branch.label.toLowerCase().replace(/\s+/g, "-")}`,
        label: branch.label,
        dataType: "any",
      }),
    );
  }

  // Implicit default port — always present
  ports.push(makeOutputPort({ id: "default", label: "default", dataType: "any" }));

  return ports;
}

const defaultBranches = [
  { label: "Case A", condition: "value === 'a'" },
  { label: "Case B", condition: "value === 'b'" },
];

export const DecisionSwitchNodeSpec: NodeSpec<DecisionSwitchData> = {
  kind: "decision-switch",
  variant: "switch",
  category: "flow",
  label: "Switch",
  icon: "git-branch",
  ports: buildSwitchPorts(defaultBranches),
  propertySchema: decisionSwitchPropertySchema,
  defaultData: { branches: defaultBranches },
  capabilities: [],
};
