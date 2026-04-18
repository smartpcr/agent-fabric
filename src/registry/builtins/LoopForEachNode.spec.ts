import { z } from "zod";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const loopForEachPropertySchema = z.object({
  iterable: z.string().min(1),
  item: z.string(),
});

export { loopForEachPropertySchema };

type LoopForEachData = z.infer<typeof loopForEachPropertySchema>;

export const LoopForEachNodeSpec: NodeSpec<LoopForEachData> = {
  kind: "loop-foreach",
  category: "flow",
  label: "For Each",
  icon: "repeat",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "body-out", label: "Body Out", dataType: "any" }),
    makeInputPort({ id: "body-in", label: "Body In", dataType: "any" }),
    makeOutputPort({ id: "done", label: "Done", dataType: "any" }),
    makeOutputPort({ id: "break", label: "Break", dataType: "any" }),
  ],
  propertySchema: loopForEachPropertySchema,
  defaultData: { iterable: "items", item: "item" },
  capabilities: ["canHaveBackEdge"],
};
