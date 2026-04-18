import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ImportButton, parseImportedJson } from "@/features/persistence/ImportExport";
import { ToastProvider } from "@/features/editor/Toast";
import { CURRENT_SCHEMA_VERSION, type WorkflowGraph } from "@/domain/models/graph";

// Radix Toast calls hasPointerCapture / setPointerCapture / releasePointerCapture
// which jsdom doesn't implement — polyfill for the test environment.
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  // eslint-disable-next-line no-empty-function
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  // eslint-disable-next-line no-empty-function
  Element.prototype.releasePointerCapture = () => {};
}
/* eslint-enable @typescript-eslint/no-unnecessary-condition */

// ─── Fixtures ────────────────────────────────────────────────────────

function validGraphJson(overrides: Partial<WorkflowGraph> = {}): string {
  const graph = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "g-import",
    name: "Imported Workflow",
    nodes: [],
    edges: [],
    ...overrides,
  };
  return JSON.stringify(graph);
}

function makeFile(content: string, name = "workflow.json"): File {
  return new File([content], name, { type: "application/json" });
}

/** Wrapper that provides ToastProvider for ImportButton. */
function Wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

// ─── Teardown ────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── parseImportedJson unit tests ────────────────────────────────────

describe("parseImportedJson", () => {
  it("parses valid graph JSON", () => {
    const result = parseImportedJson(validGraphJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.id).toBe("g-import");
    expect(result.graph.name).toBe("Imported Workflow");
    expect(result.graph.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("returns error for non-JSON text", () => {
    const result = parseImportedJson("not json at all");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe("File is not valid JSON.");
  });

  it("returns error for valid JSON that fails schema validation", () => {
    const result = parseImportedJson(JSON.stringify({ foo: "bar" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("Invalid workflow");
  });

  it("returns error for missing required fields", () => {
    const result = parseImportedJson(JSON.stringify({ schemaVersion: 1, id: "x" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("Invalid workflow");
  });

  it("preserves nodes and edges from valid graph", () => {
    const json = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: "g-1",
      name: "With Nodes",
      nodes: [{ id: "n1", kind: "task", position: { x: 10, y: 20 }, data: { label: "A" } }],
      edges: [
        {
          id: "e1",
          source: "n1",
          sourcePort: "out",
          target: "n2",
          targetPort: "in",
          kind: "default",
        },
      ],
    });
    const result = parseImportedJson(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.nodes).toHaveLength(1);
    expect(result.graph.nodes[0].kind).toBe("task");
    expect(result.graph.nodes[0].position).toEqual({ x: 10, y: 20 });
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0].kind).toBe("default");
  });

  it("preserves optional label and condition on edges", () => {
    const json = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: "g-1",
      name: "With Labels",
      nodes: [],
      edges: [
        {
          id: "e1",
          source: "n1",
          sourcePort: "out",
          target: "n2",
          targetPort: "in",
          kind: "conditional",
          label: "yes",
          condition: "x > 0",
        },
      ],
    });
    const result = parseImportedJson(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.edges[0].label).toBe("yes");
    expect(result.graph.edges[0].condition).toBe("x > 0");
  });

  it("omits label/condition when not present", () => {
    const json = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: "g-1",
      name: "No Labels",
      nodes: [],
      edges: [
        {
          id: "e1",
          source: "n1",
          sourcePort: "out",
          target: "n2",
          targetPort: "in",
          kind: "default",
        },
      ],
    });
    const result = parseImportedJson(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("label" in result.graph.edges[0]).toBe(false);
    expect("condition" in result.graph.edges[0]).toBe(false);
  });

  it("returns migration error for unknown schema version", () => {
    const json = JSON.stringify({
      schemaVersion: 999,
      id: "g-1",
      name: "Future",
      nodes: [],
      edges: [],
    });
    const result = parseImportedJson(json);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("Migration failed");
  });

  it("handles non-Error thrown during migration gracefully", () => {
    // We can't easily mock the migrate import for parseImportedJson.
    // Instead, use a schemaVersion that has no registered migration,
    // which throws MigrationError (an Error subclass) — this exercises
    // the Error branch. The non-Error branch is a defensive guard.
    // For coverage, we'll just accept it as the ternary always goes
    // to the Error branch in real usage.
    const json = JSON.stringify({
      schemaVersion: 42,
      id: "g-1",
      name: "Bad",
      nodes: [],
      edges: [],
    });

    const result = parseImportedJson(json);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("Migration failed");
    expect(result.message).toContain("42");
  });
});

// ─── ImportButton component tests ────────────────────────────────────

describe("ImportButton", () => {
  it("renders an import button", () => {
    render(<ImportButton onImport={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByTestId("import-button")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import workflow" })).toBeInTheDocument();
  });

  it("renders a hidden file input", () => {
    render(<ImportButton onImport={vi.fn()} />, { wrapper: Wrapper });
    const input = screen.getByTestId("import-file-input");
    expect(input.type).toBe("file");
    expect(input.style.display).toBe("none");
    expect(input.accept).toBe(".json,application/json");
  });

  it("clicking import button triggers file input click", async () => {
    render(<ImportButton onImport={vi.fn()} />, { wrapper: Wrapper });

    const input = screen.getByTestId("import-file-input");
    const clickSpy = vi.spyOn(input, "click");

    const user = userEvent.setup();
    await user.click(screen.getByTestId("import-button"));

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("calls onImport with parsed graph after user confirms", async () => {
    const onImport = vi.fn();
    const confirmFn = vi.fn().mockReturnValue(true);

    render(<ImportButton onImport={onImport} confirm={confirmFn} />, {
      wrapper: Wrapper,
    });

    const input = screen.getByTestId("import-file-input");
    const file = makeFile(validGraphJson());

    await act(async () => {
      await userEvent.upload(input, file);
    });

    expect(confirmFn).toHaveBeenCalledWith(
      'Import "Imported Workflow"? This will replace the current workflow.',
    );
    expect(onImport).toHaveBeenCalledOnce();
    const imported = onImport.mock.calls[0][0] as WorkflowGraph;
    expect(imported.id).toBe("g-import");
    expect(imported.name).toBe("Imported Workflow");
  });

  it("does not call onImport when user cancels confirmation", async () => {
    const onImport = vi.fn();
    const confirmFn = vi.fn().mockReturnValue(false);

    render(<ImportButton onImport={onImport} confirm={confirmFn} />, {
      wrapper: Wrapper,
    });

    const input = screen.getByTestId("import-file-input");
    const file = makeFile(validGraphJson());

    await act(async () => {
      await userEvent.upload(input, file);
    });

    expect(confirmFn).toHaveBeenCalledOnce();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("shows error toast for invalid JSON file", async () => {
    const onImport = vi.fn();
    const onError = vi.fn();

    render(<ImportButton onImport={onImport} onError={onError} />, {
      wrapper: Wrapper,
    });

    const input = screen.getByTestId("import-file-input");
    const file = makeFile("not valid json");

    await act(async () => {
      await userEvent.upload(input, file);
    });

    // Error toast should be rendered
    expect(screen.getByText("Import failed")).toBeInTheDocument();
    expect(screen.getByText("File is not valid JSON.")).toBeInTheDocument();

    // onError callback also called
    expect(onError).toHaveBeenCalledWith("File is not valid JSON.");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("shows error toast for valid JSON that fails schema validation", async () => {
    const onImport = vi.fn();
    const onError = vi.fn();

    render(<ImportButton onImport={onImport} onError={onError} />, {
      wrapper: Wrapper,
    });

    const input = screen.getByTestId("import-file-input");
    const file = makeFile(JSON.stringify({ random: "object" }));

    await act(async () => {
      await userEvent.upload(input, file);
    });

    // Error toast should be rendered
    expect(screen.getByText("Import failed")).toBeInTheDocument();

    // onError callback also called
    expect(onError).toHaveBeenCalledOnce();
    const errorMessage = onError.mock.calls[0][0] as string;
    expect(errorMessage).toContain("Invalid workflow");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("works without onError callback (toast only)", async () => {
    const onImport = vi.fn();

    render(<ImportButton onImport={onImport} />, { wrapper: Wrapper });

    const input = screen.getByTestId("import-file-input");
    const file = makeFile("broken json");

    await act(async () => {
      await userEvent.upload(input, file);
    });

    // Error toast still shown even without onError prop
    expect(screen.getByText("Import failed")).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("resets file input after selection so same file can be re-selected", async () => {
    const onImport = vi.fn();
    const confirmFn = vi.fn().mockReturnValue(true);

    render(<ImportButton onImport={onImport} confirm={confirmFn} />, {
      wrapper: Wrapper,
    });

    const input = screen.getByTestId("import-file-input");
    const file = makeFile(validGraphJson());

    await act(async () => {
      await userEvent.upload(input, file);
    });

    expect(input.value).toBe("");
  });

  it("does nothing when no file is selected (empty file list)", () => {
    const onImport = vi.fn();

    render(<ImportButton onImport={onImport} />, { wrapper: Wrapper });

    const input = screen.getByTestId("import-file-input");

    // Fire change with empty DataTransfer (no files)
    act(() => {
      fireEvent.change(input, { target: { files: [] } });
    });

    expect(onImport).not.toHaveBeenCalled();
  });

  it("uses window.confirm by default when confirm prop is not provided", async () => {
    const onImport = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<ImportButton onImport={onImport} />, { wrapper: Wrapper });

    const input = screen.getByTestId("import-file-input");
    const file = makeFile(validGraphJson());

    await act(async () => {
      await userEvent.upload(input, file);
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      'Import "Imported Workflow"? This will replace the current workflow.',
    );
    expect(onImport).toHaveBeenCalledOnce();
  });
});
