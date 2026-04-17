import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateSpec, type NodeSpec } from "@/domain/models/nodeSpec";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

const taskSchema = z.object({
  prompt: z.string(),
  temperature: z.number().min(0).max(2),
});

type TaskData = z.infer<typeof taskSchema>;

function makeValidSpec(): NodeSpec<TaskData> {
  return {
    kind: "task",
    category: "general",
    label: "Task Node",
    icon: "play",
    ports: [
      makeInputPort({ id: "in1", label: "Input" }),
      makeOutputPort({ id: "out1", label: "Output" }),
    ],
    propertySchema: taskSchema,
    defaultData: { prompt: "", temperature: 0.7 },
    capabilities: ["execute"],
  };
}

describe("NodeSpec", () => {
  describe("validateSpec", () => {
    it("accepts a valid spec", () => {
      expect(() => {
        validateSpec(makeValidSpec());
      }).not.toThrow();
    });

    it("accepts a spec with no ports", () => {
      const spec: NodeSpec<TaskData> = {
        ...makeValidSpec(),
        ports: [],
      };
      expect(() => {
        validateSpec(spec);
      }).not.toThrow();
    });

    it("accepts a spec with empty capabilities", () => {
      const spec: NodeSpec<TaskData> = {
        ...makeValidSpec(),
        capabilities: [],
      };
      expect(() => {
        validateSpec(spec);
      }).not.toThrow();
    });

    it("rejects duplicate port ids", () => {
      const spec: NodeSpec<TaskData> = {
        ...makeValidSpec(),
        ports: [
          makeInputPort({ id: "shared", label: "A" }),
          makeOutputPort({ id: "shared", label: "B" }),
        ],
      };
      expect(() => {
        validateSpec(spec);
      }).toThrow('Duplicate port id "shared"');
    });

    it("rejects defaultData that does not conform to propertySchema", () => {
      const spec: NodeSpec<TaskData> = {
        ...makeValidSpec(),
        defaultData: { prompt: 42, temperature: 5 } as unknown as TaskData,
      };
      expect(() => {
        validateSpec(spec);
      }).toThrow("does not conform");
    });

    it("accepts when defaultData exactly matches schema", () => {
      const simpleSchema = z.object({ name: z.string() });
      const spec: NodeSpec<{ name: string }> = {
        kind: "simple",
        category: "util",
        label: "Simple",
        icon: "dot",
        ports: [],
        propertySchema: simpleSchema,
        defaultData: { name: "test" },
        capabilities: [],
      };
      expect(() => {
        validateSpec(spec);
      }).not.toThrow();
    });

    it("includes the spec kind in the duplicate port error", () => {
      const spec: NodeSpec<TaskData> = {
        ...makeValidSpec(),
        kind: "myKind",
        ports: [makeInputPort({ id: "dup", label: "A" }), makeInputPort({ id: "dup", label: "B" })],
      };
      expect(() => {
        validateSpec(spec);
      }).toThrow('"myKind"');
    });

    it("includes the spec kind in the schema error", () => {
      const spec: NodeSpec<TaskData> = {
        ...makeValidSpec(),
        kind: "badNode",
        defaultData: {} as unknown as TaskData,
      };
      expect(() => {
        validateSpec(spec);
      }).toThrow('"badNode"');
    });
  });
});
