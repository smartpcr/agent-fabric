import { z } from "zod";
import { makeInputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

export const EndNodeSpec: NodeSpec<Record<string, never>> = {
  kind: "end",
  category: "flow",
  label: "End",
  icon: "stop",
  ports: [makeInputPort({ id: "in", label: "In", dataType: "any" })],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: ["isTerminal"],
};
