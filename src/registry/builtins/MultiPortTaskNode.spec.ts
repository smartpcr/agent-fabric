import { z } from "zod";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const multiPortTaskPropertySchema = z.object({
  name: z.string().min(1),
  params: z.record(z.string(), z.unknown())["default"]({}),
});

type MultiPortTaskData = z.infer<typeof multiPortTaskPropertySchema>;

export const MultiPortTaskNodeSpec: NodeSpec<MultiPortTaskData> = {
  kind: "task-multi",
  category: "flow",
  label: "Multi-Port Task",
  icon: "cog",
  ports: [
    makeInputPort({ id: "inA", label: "Input A", dataType: "string" }),
    makeInputPort({ id: "inB", label: "Input B", dataType: "json" }),
    makeOutputPort({ id: "outA", label: "Output A", dataType: "string" }),
    makeOutputPort({ id: "outB", label: "Output B", dataType: "json" }),
    makeOutputPort({ id: "outC", label: "Output C", dataType: "any" }),
  ],
  propertySchema: multiPortTaskPropertySchema,
  defaultData: { name: "Multi-Port Task", params: {} },
  capabilities: [],
};
