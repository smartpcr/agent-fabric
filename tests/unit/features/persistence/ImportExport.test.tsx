import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ExportButton,
  sanitizeFilename,
  buildFilename,
  downloadBlob,
} from "@/features/persistence/ImportExport";
import { CURRENT_SCHEMA_VERSION, type WorkflowGraph } from "@/domain/models/graph";

// ─── Fixtures ────────────────────────────────────────────────────────

function makeGraph(overrides: Partial<WorkflowGraph> = {}): WorkflowGraph {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "g-1",
    name: "Test Workflow",
    nodes: [],
    edges: [],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── sanitizeFilename ────────────────────────────────────────────────

describe("sanitizeFilename", () => {
  it("replaces spaces and special characters with hyphens", () => {
    expect(sanitizeFilename("My Workflow!")).toBe("My-Workflow");
  });

  it("collapses consecutive hyphens", () => {
    expect(sanitizeFilename("a   b")).toBe("a-b");
  });

  it("trims leading and trailing hyphens", () => {
    expect(sanitizeFilename("  hello  ")).toBe("hello");
  });

  it("preserves underscores and hyphens", () => {
    expect(sanitizeFilename("my_flow-v2")).toBe("my_flow-v2");
  });

  it("returns empty string for all-special input", () => {
    expect(sanitizeFilename("!!!")).toBe("");
  });
});

// ─── buildFilename ───────────────────────────────────────────────────

describe("buildFilename", () => {
  it("includes sanitized name and timestamp", () => {
    const now = new Date(2025, 2, 15, 9, 5, 3); // March 15, 2025 09:05:03
    const result = buildFilename("My Flow", now);
    expect(result).toBe("My-Flow_20250315-090503.json");
  });

  it("falls back to 'workflow' when name sanitizes to empty", () => {
    const now = new Date(2025, 0, 1, 0, 0, 0);
    const result = buildFilename("!!!", now);
    expect(result).toBe("workflow_20250101-000000.json");
  });

  it("pads single-digit month/day/hour/min/sec", () => {
    const now = new Date(2025, 0, 2, 3, 4, 5);
    const result = buildFilename("x", now);
    expect(result).toBe("x_20250102-030405.json");
  });
});

// ─── downloadBlob ────────────────────────────────────────────────────

describe("downloadBlob", () => {
  it("creates an <a> element, sets href/download, clicks it, and cleans up", () => {
    const fakeUrl = "blob:http://localhost/fake-uuid";
    const createObjectURL = vi.fn().mockReturnValue(fakeUrl);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.fn();
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");

    // Mock createElement to capture the anchor
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- testing DOM API
    const origCreateElement = document.createElement.bind(document);
    let capturedAnchor: HTMLAnchorElement | null = null;
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- testing DOM API
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === "a") {
        capturedAnchor = el as HTMLAnchorElement;
        capturedAnchor.click = clickSpy;
      }
      return el;
    });

    const blob = new Blob(["test"], { type: "application/json" });
    downloadBlob(blob, "my-file.json");

    // createObjectURL called with the blob
    expect(createObjectURL).toHaveBeenCalledWith(blob);

    // Anchor was configured correctly
    expect(capturedAnchor).toBeDefined();
    const anchor = capturedAnchor as unknown as HTMLAnchorElement;
    expect(anchor.href).toBe(fakeUrl);
    expect(anchor.download).toBe("my-file.json");
    expect(anchor.style.display).toBe("none");

    // Anchor was appended, clicked, removed
    expect(appendChildSpy).toHaveBeenCalledWith(capturedAnchor);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledWith(capturedAnchor);

    // Object URL was revoked
    expect(revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
  });
});

// ─── ExportButton component ──────────────────────────────────────────

describe("ExportButton", () => {
  it("renders an export button", () => {
    render(<ExportButton graph={makeGraph()} />);
    expect(screen.getByTestId("export-button")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export workflow" })).toBeInTheDocument();
  });

  it("clicking export triggers download with correct JSON content", async () => {
    const graph = makeGraph({ name: "Alpha", id: "id-alpha" });

    let capturedBlob: Blob | null = null;
    let capturedFilename: string | null = null;
    const mockDownload = vi.fn((blob: Blob, filename: string) => {
      capturedBlob = blob;
      capturedFilename = filename;
    });

    render(<ExportButton graph={graph} onDownload={mockDownload} />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("export-button"));

    expect(mockDownload).toHaveBeenCalledOnce();

    // Blob was created with correct JSON
    expect(capturedBlob).toBeDefined();
    const theBlob = capturedBlob as unknown as Blob;
    const text = await theBlob.text();
    const parsed = JSON.parse(text) as WorkflowGraph;
    expect(parsed.id).toBe("id-alpha");
    expect(parsed.name).toBe("Alpha");
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.nodes).toEqual([]);
    expect(parsed.edges).toEqual([]);

    // Filename includes workflow name
    expect(capturedFilename).toBeDefined();
    expect(capturedFilename).toMatch(/^Alpha_\d{8}-\d{6}\.json$/);
  });

  it("filename includes timestamp from current time", async () => {
    const graph = makeGraph({ name: "Beta" });

    let capturedFilename: string | null = null;
    const mockDownload = vi.fn((_blob: Blob, filename: string) => {
      capturedFilename = filename;
    });

    render(<ExportButton graph={graph} onDownload={mockDownload} />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("export-button"));

    // Filename should be Beta_YYYYMMDD-HHmmss.json
    expect(capturedFilename).toMatch(/^Beta_\d{8}-\d{6}\.json$/);
  });

  it("serializes graph with indentation for readability", async () => {
    const graph = makeGraph({ name: "Gamma" });

    let capturedBlob: Blob | null = null;
    const mockDownload = vi.fn((blob: Blob) => {
      capturedBlob = blob;
    });

    render(<ExportButton graph={graph} onDownload={mockDownload} />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId("export-button"));

    expect(capturedBlob).toBeDefined();
    const theBlob = capturedBlob as unknown as Blob;
    const text = await theBlob.text();
    // Indented JSON has newlines
    expect(text).toContain("\n");
    expect(text).toBe(JSON.stringify(graph, null, 2));
  });

  it("handles graph names with special characters in filename", async () => {
    const graph = makeGraph({ name: "My Flow (v2)!" });

    let capturedFilename: string | null = null;
    const mockDownload = vi.fn((_blob: Blob, filename: string) => {
      capturedFilename = filename;
    });

    render(<ExportButton graph={graph} onDownload={mockDownload} />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId("export-button"));

    // Special chars sanitized; timestamp portion is dynamic
    expect(capturedFilename).toMatch(/^My-Flow-v2_\d{8}-\d{6}\.json$/);
  });

  it("uses downloadBlob by default when onDownload is not provided", () => {
    const graph = makeGraph({ name: "Delta" });

    // Stub URL APIs to prevent jsdom errors
    const fakeUrl = "blob:http://localhost/test";
    const createObjectURL = vi.fn().mockReturnValue(fakeUrl);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- testing DOM API
    const origCreateElement = document.createElement.bind(document);
    const clickSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- testing DOM API
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === "a") {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });

    // Render without onDownload — exercises the default path
    render(<ExportButton graph={graph} />);

    // Directly invoke the callback via the button click handler
    const btn = screen.getByTestId("export-button");
    btn.click();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
  });
});
