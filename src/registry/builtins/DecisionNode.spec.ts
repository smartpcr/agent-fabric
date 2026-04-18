import { z } from "zod";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const decisionPropertySchema = z.object({
  condition: z.string().min(1),
});

type DecisionData = z.infer<typeof decisionPropertySchema>;

export const DecisionNodeSpec: NodeSpec<DecisionData> = {
  kind: "decision",
  variant: "if-else",
  category: "flow",
  label: "Decision",
  icon: "git-branch",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "true", label: "True", dataType: "any" }),
    makeOutputPort({ id: "false", label: "False", dataType: "any" }),
  ],
  propertySchema: decisionPropertySchema,
  defaultData: { condition: "value == true" },
  capabilities: [],
};
