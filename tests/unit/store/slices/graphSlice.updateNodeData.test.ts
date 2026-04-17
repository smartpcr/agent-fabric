import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";
import type { NodeSpecRegistry } from "@/domain/validation/connectionRules";

const taskSchema = z.object({
  name: z.string().min(1),
  params: z.record(z.string(), z.unknown())["default"]({}),
});

type TaskData = z.infer<typeof taskSchema>;

const taskSpec: NodeSpec<TaskData> = {
  kind: "task",
  category: "flow",
  label: "Task",
  icon: "cog",
  ports: [
    makeInputPort({ id: "in", label: "In", dataType: "any" }),
    makeOutputPort({ id: "out", label: "Out", dataType: "any" }),
  ],
  propertySchema: taskSchema,
  defaultData: { name: "Task", params: {} },
  capabilities: [],
};

const startSpec: NodeSpec = {
  kind: "start",
  category: "flow",
  label: "Start",
  icon: "play",
  ports: [makeOutputPort({ id: "out", label: "Out", dataType: "any" })],
  propertySchema: z.object({}),
  defaultData: {},
  capabilities: ["isEntry"],
};

function makeRegistry(): NodeSpecRegistry {
  const map = new Map<string, NodeSpec>([
    ["task", taskSpec],
    ["start", startSpec],
  ]);
  return { get: (kind: string) => map.get(kind) };
}

describe("graphSlice.updateNodeData", () => {
  it("updates node data on valid input", () => {
    const store = createStore();
    const registry = makeRegistry();
    const node = store.getState().addNode(taskSpec);

    const result = store.getState().updateNodeData({
      id: node.id,
      data: { name: "Updated", params: { key: "value" } },
      registry,
    });

    expect(result.ok).toBe(true);
    expect(store.getState().nodes[0].data).toEqual({ name: "Updated", params: { key: "value" } });
  });

  it("returns ok with void value on success", () => {
    const store = createStore();
    const registry = makeRegistry();
    const node = store.getState().addNode(taskSpec);

    const result = store.getState().updateNodeData({
      id: node.id,
      data: { name: "New Name", params: {} },
      registry,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeUndefined();
    }
  });

  it("returns validation errors for invalid data", () => {
    const store = createStore();
    const registry = makeRegistry();
    const node = store.getState().addNode(taskSpec);

    const result = store.getState().updateNodeData({
      id: node.id,
      data: { name: "", params: {} },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("does not mutate state on validation failure", () => {
    const store = createStore();
    const registry = makeRegistry();
    const node = store.getState().addNode(taskSpec);
    const dataBefore = store.getState().nodes[0].data;

    store.getState().updateNodeData({
      id: node.id,
      data: { name: "", params: {} },
      registry,
    });

    expect(store.getState().nodes[0].data).toBe(dataBefore);
  });

  it("returns error when node id does not exist", () => {
    const store = createStore();
    const registry = makeRegistry();

    const result = store.getState().updateNodeData({
      id: "nonexistent",
      data: { name: "X" },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].message).toContain("not found");
    }
  });

  it("returns error when spec is not in registry", () => {
    const store = createStore();
    const emptyRegistry: NodeSpecRegistry = { get: () => undefined };
    const node = store.getState().addNode(taskSpec);

    const result = store.getState().updateNodeData({
      id: node.id,
      data: { name: "X" },
      registry: emptyRegistry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].message).toContain("No spec");
    }
  });

  it("preserves other nodes when updating one", () => {
    const store = createStore();
    const registry = makeRegistry();
    const node1 = store.getState().addNode(taskSpec);
    const node2 = store.getState().addNode(startSpec);

    store.getState().updateNodeData({
      id: node1.id,
      data: { name: "Changed", params: {} },
      registry,
    });

    expect(store.getState().nodes[1]).toBe(node2);
  });

  it("does not affect edges when updating node data", () => {
    const store = createStore();
    const registry = makeRegistry();
    const node = store.getState().addNode(taskSpec);
    const edgesBefore = store.getState().edges;

    store.getState().updateNodeData({
      id: node.id,
      data: { name: "Changed", params: {} },
      registry,
    });

    expect(store.getState().edges).toBe(edgesBefore);
  });

  it("returns validation error with path info for missing required field", () => {
    const store = createStore();
    const registry = makeRegistry();
    const node = store.getState().addNode(taskSpec);

    const result = store.getState().updateNodeData({
      id: node.id,
      data: { params: {} },
      registry,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.error.some(
          (e) =>
            e.path.includes("name") || e.message.includes("name") || e.message.includes("Required"),
        ),
      ).toBe(true);
    }
  });
});
