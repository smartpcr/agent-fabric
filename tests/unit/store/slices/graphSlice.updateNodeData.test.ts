import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStore } from "@/store/createStore";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

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

function setupStoreWithSpecs() {
  const store = createStore();
  store.getState().registerNodeSpec(taskSpec);
  store.getState().registerNodeSpec(startSpec);
  return store;
}

describe("graphSlice.updateNodeData", () => {
  it("updates node data on valid input", () => {
    const store = setupStoreWithSpecs();
    const node = store.getState().addNode(taskSpec);

    const result = store
      .getState()
      .updateNodeData(node.id, { name: "Updated", params: { key: "value" } });

    expect(result.ok).toBe(true);
    expect(store.getState().nodes[0].data).toEqual({ name: "Updated", params: { key: "value" } });
  });

  it("returns ok with void value on success", () => {
    const store = setupStoreWithSpecs();
    const node = store.getState().addNode(taskSpec);

    const result = store.getState().updateNodeData(node.id, { name: "New Name", params: {} });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeUndefined();
    }
  });

  it("returns validation errors for invalid data", () => {
    const store = setupStoreWithSpecs();
    const node = store.getState().addNode(taskSpec);

    const result = store.getState().updateNodeData(node.id, { name: "", params: {} });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("does not mutate state on validation failure", () => {
    const store = setupStoreWithSpecs();
    const node = store.getState().addNode(taskSpec);
    const dataBefore = store.getState().nodes[0].data;

    store.getState().updateNodeData(node.id, { name: "", params: {} });

    expect(store.getState().nodes[0].data).toBe(dataBefore);
  });

  it("returns error when node id does not exist", () => {
    const store = setupStoreWithSpecs();

    const result = store.getState().updateNodeData("nonexistent", { name: "X" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].message).toContain("not found");
    }
  });

  it("returns error when spec is not registered in store", () => {
    const store = createStore();
    const node = store.getState().addNode(taskSpec);

    const result = store.getState().updateNodeData(node.id, { name: "X" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].message).toContain("No spec");
    }
  });

  it("preserves other nodes when updating one", () => {
    const store = setupStoreWithSpecs();
    const node1 = store.getState().addNode(taskSpec);
    const node2 = store.getState().addNode(startSpec);

    store.getState().updateNodeData(node1.id, { name: "Changed", params: {} });

    expect(store.getState().nodes[1]).toBe(node2);
  });

  it("does not affect edges when updating node data", () => {
    const store = setupStoreWithSpecs();
    const node = store.getState().addNode(taskSpec);
    const edgesBefore = store.getState().edges;

    store.getState().updateNodeData(node.id, { name: "Changed", params: {} });

    expect(store.getState().edges).toBe(edgesBefore);
  });

  it("returns validation error with path info for missing required field", () => {
    const store = setupStoreWithSpecs();
    const node = store.getState().addNode(taskSpec);

    const result = store.getState().updateNodeData(node.id, { params: {} });

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
