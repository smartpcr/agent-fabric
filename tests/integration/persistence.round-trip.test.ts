import { describe, it, expect } from "vitest";
import { CURRENT_SCHEMA_VERSION, type WorkflowGraph } from "@/domain/models/graph";
import {
  parseImportedJson,
  buildFilename,
  sanitizeFilename,
} from "@/features/persistence/ImportExport";
import type { WorkflowNode } from "@/domain/models/node";
import type { WorkflowEdge } from "@/domain/models/edge";

// ─── Fixture helpers ─────────────────────────────────────────────────

function buildTestGraph(): WorkflowGraph {
  const nodes: WorkflowNode[] = [
    { id: "n-start", kind: "start", position: { x: 0, y: 0 }, data: {} },
    { id: "n-task", kind: "task", position: { x: 200, y: 100 }, data: { label: "Do work" } },
    { id: "n-decision", kind: "decision", position: { x: 400, y: 100 }, data: {} },
    { id: "n-end", kind: "end", position: { x: 600, y: 0 }, data: {} },
  ];

  const edges: WorkflowEdge[] = [
    {
      id: "e1",
      source: "n-start",
      sourcePort: "out",
      target: "n-task",
      targetPort: "in",
      kind: "default",
    },
    {
      id: "e2",
      source: "n-task",
      sourcePort: "out",
      target: "n-decision",
      targetPort: "in",
      kind: "default",
      label: "completed",
    },
    {
      id: "e3",
      source: "n-decision",
      sourcePort: "yes",
      target: "n-end",
      targetPort: "in",
      kind: "conditional",
      condition: "result === true",
    },
  ];

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "wf-roundtrip",
    name: "Round Trip Workflow",
    nodes,
    edges,
  };
}

/** Serialize a graph exactly as ExportButton does. */
function exportGraph(graph: WorkflowGraph): string {
  return JSON.stringify(graph, null, 2);
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("persistence.round-trip", () => {
  it("export → import round-trip preserves graph identity", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);
    const result = parseImportedJson(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.graph).toEqual(original);
  });

  it("export → edit name → import yields original + name edit", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);

    // Simulate manual edit: change workflow name
    const parsed = JSON.parse(json) as Record<string, unknown>;
    parsed.name = "Renamed Workflow";
    const edited = JSON.stringify(parsed, null, 2);

    const result = parseImportedJson(edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Name should reflect the edit
    expect(result.graph.name).toBe("Renamed Workflow");
    // Everything else unchanged
    expect(result.graph.id).toBe(original.id);
    expect(result.graph.schemaVersion).toBe(original.schemaVersion);
    expect(result.graph.nodes).toEqual(original.nodes);
    expect(result.graph.edges).toEqual(original.edges);
  });

  it("export → edit node position → import yields original + position edit", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);

    // Simulate manual edit: move the task node
    const parsed = JSON.parse(json) as {
      nodes: Array<{ id: string; position: { x: number; y: number } }>;
    };
    const taskIdx = parsed.nodes.findIndex((n) => n.id === "n-task");
    expect(taskIdx).toBeGreaterThanOrEqual(0);
    parsed.nodes[taskIdx].position = { x: 300, y: 150 };
    const edited = JSON.stringify(parsed, null, 2);

    const result = parseImportedJson(edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Task node should have the new position
    const importedTask = result.graph.nodes.find((n) => n.id === "n-task");
    expect(importedTask).toBeDefined();
    expect(importedTask).toHaveProperty("position", { x: 300, y: 150 });

    // Other nodes untouched
    const otherNodes = result.graph.nodes.filter((n) => n.id !== "n-task");
    const originalOthers = original.nodes.filter((n) => n.id !== "n-task");
    expect(otherNodes).toEqual(originalOthers);
  });

  it("export → add edge label → import yields original + label edit", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);

    // Simulate manual edit: add label to the first edge
    const parsed = JSON.parse(json) as {
      edges: Array<{ id: string; label?: string }>;
    };
    const edgeIdx = parsed.edges.findIndex((e) => e.id === "e1");
    expect(edgeIdx).toBeGreaterThanOrEqual(0);
    parsed.edges[edgeIdx].label = "start → task";
    const edited = JSON.stringify(parsed, null, 2);

    const result = parseImportedJson(edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const importedEdge = result.graph.edges.find((e) => e.id === "e1");
    expect(importedEdge).toBeDefined();
    expect(importedEdge).toHaveProperty("label", "start → task");

    // Other edges untouched
    const otherEdges = result.graph.edges.filter((e) => e.id !== "e1");
    const originalOthers = original.edges.filter((e) => e.id !== "e1");
    expect(otherEdges).toEqual(originalOthers);
  });

  it("export → change condition on conditional edge → import reflects edit", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);

    const parsed = JSON.parse(json) as {
      edges: Array<{ id: string; condition?: string }>;
    };
    const condIdx = parsed.edges.findIndex((e) => e.id === "e3");
    expect(condIdx).toBeGreaterThanOrEqual(0);
    parsed.edges[condIdx].condition = "count > 10";
    const edited = JSON.stringify(parsed, null, 2);

    const result = parseImportedJson(edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const importedEdge = result.graph.edges.find((e) => e.id === "e3");
    expect(importedEdge).toHaveProperty("condition", "count > 10");
    expect(importedEdge).toHaveProperty("kind", "conditional");
  });

  it("export → add a new node → import yields graph with extra node", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);

    const parsed = JSON.parse(json) as {
      nodes: Array<{ id: string; kind: string; position: { x: number; y: number }; data: unknown }>;
    };
    parsed.nodes.push({
      id: "n-new",
      kind: "task",
      position: { x: 500, y: 200 },
      data: { label: "Extra step" },
    });
    const edited = JSON.stringify(parsed, null, 2);

    const result = parseImportedJson(edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.graph.nodes).toHaveLength(original.nodes.length + 1);
    const newNode = result.graph.nodes.find((n) => n.id === "n-new");
    expect(newNode).toBeDefined();
    expect(newNode).toHaveProperty("kind", "task");
    expect(newNode).toHaveProperty("data", { label: "Extra step" });
  });

  it("export → remove a node + its edges → import yields pruned graph", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);

    const parsed = JSON.parse(json) as {
      nodes: Array<{ id: string }>;
      edges: Array<{ id: string; source: string; target: string }>;
    };
    // Remove the decision node and edges connected to it
    parsed.nodes = parsed.nodes.filter((n) => n.id !== "n-decision");
    parsed.edges = parsed.edges.filter(
      (e) => e.source !== "n-decision" && e.target !== "n-decision",
    );
    const edited = JSON.stringify(parsed, null, 2);

    const result = parseImportedJson(edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.graph.nodes).toHaveLength(original.nodes.length - 1);
    expect(result.graph.nodes.find((n) => n.id === "n-decision")).toBeUndefined();

    // Only e1 should remain (e2 and e3 touched n-decision)
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0].id).toBe("e1");
  });

  it("import rejects corrupted JSON that was valid before editing", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);

    // Corrupt the JSON by truncating
    const corrupted = json.slice(0, Math.floor(json.length / 2));
    const result = parseImportedJson(corrupted);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe("File is not valid JSON.");
  });

  it("import rejects when a required field is removed", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);

    const parsed = JSON.parse(json) as Record<string, unknown>;
    delete parsed.name;
    const edited = JSON.stringify(parsed, null, 2);

    const result = parseImportedJson(edited);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("Invalid workflow");
  });

  it("multiple edits applied simultaneously round-trip correctly", () => {
    const original = buildTestGraph();
    const json = exportGraph(original);

    const parsed = JSON.parse(json) as {
      name: string;
      nodes: Array<{ id: string; position: { x: number; y: number }; data: unknown }>;
      edges: Array<{ id: string; label?: string }>;
    };

    // Edit 1: rename workflow
    parsed.name = "Multi-edit WF";
    // Edit 2: move start node
    const startIdx = parsed.nodes.findIndex((n) => n.id === "n-start");
    expect(startIdx).toBeGreaterThanOrEqual(0);
    parsed.nodes[startIdx].position = { x: 50, y: 50 };
    // Edit 3: add label to first edge
    const edgeIdx = parsed.edges.findIndex((e) => e.id === "e1");
    expect(edgeIdx).toBeGreaterThanOrEqual(0);
    parsed.edges[edgeIdx].label = "begin";

    const edited = JSON.stringify(parsed, null, 2);
    const result = parseImportedJson(edited);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.graph.name).toBe("Multi-edit WF");
    const importedStart = result.graph.nodes.find((n) => n.id === "n-start");
    expect(importedStart).toHaveProperty("position", { x: 50, y: 50 });
    const importedEdge = result.graph.edges.find((e) => e.id === "e1");
    expect(importedEdge).toHaveProperty("label", "begin");

    // Untouched fields remain
    expect(result.graph.id).toBe(original.id);
    expect(result.graph.nodes).toHaveLength(original.nodes.length);
    expect(result.graph.edges).toHaveLength(original.edges.length);
  });

  it("export filename includes sanitized workflow name and timestamp", () => {
    const name = "Round Trip Workflow!@#";
    const now = new Date(2025, 0, 15, 10, 30, 45);
    const filename = buildFilename(name, now);

    expect(filename).toMatch(/^Round-Trip-Workflow_\d{8}-\d{6}\.json$/);
    expect(filename).toBe("Round-Trip-Workflow_20250115-103045.json");
  });

  it("sanitizeFilename handles edge cases", () => {
    expect(sanitizeFilename("")).toBe("");
    expect(sanitizeFilename("simple")).toBe("simple");
    expect(sanitizeFilename("has spaces and !special")).toBe("has-spaces-and-special");
    expect(sanitizeFilename("---leading---trailing---")).toBe("leading-trailing");
  });
});
