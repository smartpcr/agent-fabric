import { z } from "zod";
import { makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

export const StartNodeSpec: NodeSpec<Record<string, never>> = {
  kind: "start",
  category: "flow",
  label: "Start",
  icon: "play",
  ports: [makeOutputPort({ id: "out", label: "Out", dataType: "any" })],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: ["isEntry"],
};
