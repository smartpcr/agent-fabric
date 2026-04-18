import { z } from "zod";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const loopWhilePropertySchema = z.object({
  condition: z.string().min(1),
});

export { loopWhilePropertySchema };

type LoopWhileData = z.infer<typeof loopWhilePropertySchema>;

export const LoopWhileNodeSpec: NodeSpec<LoopWhileData> = {
  kind: "loop-while",
  category: "flow",
  label: "While Loop",
  icon: "repeat",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "body-out", label: "Body Out", dataType: "any" }),
    makeInputPort({ id: "body-in", label: "Body In", dataType: "any" }),
    makeOutputPort({ id: "done", label: "Done", dataType: "any" }),
  ],
  propertySchema: loopWhilePropertySchema,
  defaultData: { condition: "count < 10" },
  capabilities: ["canHaveBackEdge"],
};
