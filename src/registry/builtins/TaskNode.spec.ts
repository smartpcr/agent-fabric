import { z } from "zod";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const taskPropertySchema = z.object({
  name: z.string().min(1),
  params: z.record(z.string(), z.unknown())["default"]({}),
});

type TaskData = z.infer<typeof taskPropertySchema>;

export const TaskNodeSpec: NodeSpec<TaskData> = {
  kind: "task",
  category: "flow",
  label: "Task",
  icon: "cog",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
  ],
  propertySchema: taskPropertySchema,
  defaultData: { name: "Task", params: {} },
  capabilities: [],
};
