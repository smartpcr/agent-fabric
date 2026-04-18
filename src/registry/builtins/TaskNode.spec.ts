import { z } from "zod";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const taskPropertySchema = z.object({
  name: z.string().min(1),
  retries: z.number()["int"]().min(0)["default"](3),
  tags: z.array(z.string())["default"]([]),
  params: z.record(z.string(), z.unknown())["default"]({}),
  apiKey: z.string()["default"]("").describe("{ secret: true }"),
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
  defaultData: { name: "Task", retries: 3, tags: [], params: {}, apiKey: "" },
  capabilities: [],
};
