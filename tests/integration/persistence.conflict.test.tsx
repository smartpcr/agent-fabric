import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";
import { InMemoryWorkflowRepository } from "@/adapters/InMemoryWorkflowRepository";
import { RepositoryProvider } from "@/providers/RepositoryProvider";
import { ToastProvider } from "@/features/editor/Toast";
import { useSave, type UseSaveReturn } from "@/features/persistence/useSave";
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

function makeGraph(id: string, name: string): WorkflowGraph {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    name,
    nodes: [],
    edges: [],
  };
}

// ─── Test harness ────────────────────────────────────────────────────

/** Mutable container for capturing hook result from within the component tree. */
const hookRef: { current: UseSaveReturn | null } = { current: null };

function Wrapper({
  children,
  repo,
  onReload,
}: {
  children?: ReactNode;
  repo: InMemoryWorkflowRepository;
  onReload?: (id: string) => void;
}) {
  return (
    <RepositoryProvider repository={repo}>
      <ToastProvider>
        <Inner onReload={onReload} />
        {children}
      </ToastProvider>
    </RepositoryProvider>
  );
}

function Inner({ onReload }: { onReload?: (id: string) => void }) {
  const hookVal = useSave({ onReload });

  useEffect(() => {
    hookRef.current = hookVal;
  });

  return (
    <div>
      <span data-testid="saving">{String(hookVal.saving)}</span>
      <span data-testid="etag">{hookVal.etag ?? "null"}</span>
    </div>
  );
}

/** Helper to get the hook result (throws if not mounted). */
function getHook(): UseSaveReturn {
  if (hookRef.current === null) throw new Error("Hook not mounted");
  return hookRef.current;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("persistence.conflict integration", () => {
  let repo: InMemoryWorkflowRepository;

  beforeEach(() => {
    repo = new InMemoryWorkflowRepository();
  });

  afterEach(() => {
    cleanup();
    hookRef.current = null;
  });

  it("updates etag after a successful save", async () => {
    const graph = makeGraph("wf-1", "Test Workflow");
    await repo.create(graph);

    render(<Wrapper repo={repo} />);

    // Load initial etag
    const getResult = await repo.get("wf-1");
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    const initialEtag = getResult.value.etag;

    // Set the etag on the hook
    act(() => {
      getHook().setEtag(initialEtag);
    });

    // Save
    let saveResult: Awaited<ReturnType<UseSaveReturn["save"]>> | undefined;
    await act(async () => {
      saveResult = await getHook().save("wf-1", makeGraph("wf-1", "Updated"));
    });

    expect(saveResult?.ok).toBe(true);
    // ETag should have advanced
    expect(screen.getByTestId("etag").textContent).not.toBe("null");
    expect(screen.getByTestId("etag").textContent).not.toBe(initialEtag);
  });

  it("shows conflict toast with Reload and Force save on 409", async () => {
    const graph = makeGraph("wf-conflict", "Original");
    await repo.create(graph);

    const onReload = vi.fn();
    render(<Wrapper repo={repo} onReload={onReload} />);

    // Load initial etag
    const getResult = await repo.get("wf-conflict");
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;

    act(() => {
      getHook().setEtag(getResult.value.etag);
    });

    // Simulate another user saving (advances server version)
    await repo.save(
      "wf-conflict",
      makeGraph("wf-conflict", "Other user's edit"),
      getResult.value.etag,
    );

    // Our save should now conflict because our etag is stale
    let saveResult: Awaited<ReturnType<UseSaveReturn["save"]>> | undefined;
    await act(async () => {
      saveResult = await getHook().save("wf-conflict", makeGraph("wf-conflict", "My edit"));
    });

    expect(saveResult?.ok).toBe(false);
    if (saveResult?.ok === false) {
      expect(saveResult.error.code).toBe("CONFLICT");
    }

    // Toast should be visible with the conflict message
    expect(screen.getByText("Workflow changed elsewhere")).toBeInTheDocument();

    // Both action buttons should be present
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Force save" })).toBeInTheDocument();
  });

  it("Reload action fetches latest version and calls onReload", async () => {
    const graph = makeGraph("wf-reload", "Original");
    await repo.create(graph);

    const onReload = vi.fn();
    render(<Wrapper repo={repo} onReload={onReload} />);

    // Load initial etag
    const getResult = await repo.get("wf-reload");
    if (!getResult.ok) return;

    act(() => {
      getHook().setEtag(getResult.value.etag);
    });

    // Another user saves
    await repo.save("wf-reload", makeGraph("wf-reload", "Other user"), getResult.value.etag);

    // Our save conflicts
    await act(async () => {
      await getHook().save("wf-reload", makeGraph("wf-reload", "My edit"));
    });

    const user = userEvent.setup();

    // Click Reload
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Reload" }));
    });

    // onReload should have been called
    expect(onReload).toHaveBeenCalledWith("wf-reload");

    // Etag should be updated to the server's latest version
    const latestGet = await repo.get("wf-reload");
    if (!latestGet.ok) return;
    expect(screen.getByTestId("etag").textContent).toBe(latestGet.value.etag);
  });

  it("Force save action saves without etag, overwriting server version", async () => {
    const graph = makeGraph("wf-force", "Original");
    await repo.create(graph);

    render(<Wrapper repo={repo} />);

    // Load initial etag
    const getResult = await repo.get("wf-force");
    if (!getResult.ok) return;

    act(() => {
      getHook().setEtag(getResult.value.etag);
    });

    // Another user saves
    await repo.save("wf-force", makeGraph("wf-force", "Other user"), getResult.value.etag);

    // Our save conflicts
    await act(async () => {
      await getHook().save("wf-force", makeGraph("wf-force", "My forced edit"));
    });

    const user = userEvent.setup();

    // Click Force save
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Force save" }));
    });

    // The workflow should now contain our force-saved data
    const saved = await repo.get("wf-force");
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.graph.name).toBe("My forced edit");

    // Etag should be updated after force save
    expect(screen.getByTestId("etag").textContent).toBe(saved.value.etag);
  });

  it("non-conflict errors are returned without showing conflict toast", async () => {
    const graph = makeGraph("wf-missing", "Ghost");
    await repo.create(graph);

    render(<Wrapper repo={repo} />);

    // Try saving a workflow that doesn't exist on the server
    let result: Awaited<ReturnType<UseSaveReturn["save"]>> | undefined;
    await act(async () => {
      result = await getHook().save("nonexistent-id", makeGraph("nonexistent-id", "Nope"));
    });

    expect(result?.ok).toBe(false);
    if (result?.ok === false) {
      expect(result.error.code).toBe("NOT_FOUND");
    }

    // No conflict toast should appear
    expect(screen.queryByText("Workflow changed elsewhere")).not.toBeInTheDocument();
  });

  it("saving state is tracked during save lifecycle", async () => {
    const graph = makeGraph("wf-saving", "Saving test");
    await repo.create(graph);

    render(<Wrapper repo={repo} />);

    expect(screen.getByTestId("saving").textContent).toBe("false");

    // After save completes, saving should be false again
    await act(async () => {
      await getHook().save("wf-saving", makeGraph("wf-saving", "Updated"));
    });

    expect(screen.getByTestId("saving").textContent).toBe("false");
  });

  it("Reload action handles load failure gracefully", async () => {
    const graph = makeGraph("wf-reload-fail", "Original");
    await repo.create(graph);

    const onReload = vi.fn();
    render(<Wrapper repo={repo} onReload={onReload} />);

    const getResult = await repo.get("wf-reload-fail");
    if (!getResult.ok) return;

    act(() => {
      getHook().setEtag(getResult.value.etag);
    });

    // Another user saves, making our etag stale
    await repo.save("wf-reload-fail", makeGraph("wf-reload-fail", "Other"), getResult.value.etag);

    // Our save conflicts
    await act(async () => {
      await getHook().save("wf-reload-fail", makeGraph("wf-reload-fail", "My edit"));
    });

    // Spy on get to make reload fail
    vi.spyOn(repo, "get").mockResolvedValueOnce({
      ok: false,
      error: { code: "NETWORK", message: "timeout" },
    });

    const user = userEvent.setup();

    // Click Reload — should not crash even though load returns error
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Reload" }));
    });

    // onReload should NOT have been called since load failed
    expect(onReload).not.toHaveBeenCalled();
  });

  it("Reload works without onReload callback", async () => {
    const graph = makeGraph("wf-no-cb", "Original");
    await repo.create(graph);

    // No onReload callback
    render(<Wrapper repo={repo} />);

    const getResult = await repo.get("wf-no-cb");
    if (!getResult.ok) return;

    act(() => {
      getHook().setEtag(getResult.value.etag);
    });

    // Another user saves
    await repo.save("wf-no-cb", makeGraph("wf-no-cb", "Other"), getResult.value.etag);

    // Our save conflicts
    await act(async () => {
      await getHook().save("wf-no-cb", makeGraph("wf-no-cb", "My edit"));
    });

    const user = userEvent.setup();

    // Click Reload — should not crash without onReload
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Reload" }));
    });

    // ETag should be updated despite no callback
    const latestGet = await repo.get("wf-no-cb");
    if (!latestGet.ok) return;
    expect(screen.getByTestId("etag").textContent).toBe(latestGet.value.etag);
  });

  it("Force save handles save failure gracefully", async () => {
    const graph = makeGraph("wf-force-fail", "Original");
    await repo.create(graph);

    render(<Wrapper repo={repo} />);

    const getResult = await repo.get("wf-force-fail");
    if (!getResult.ok) return;

    act(() => {
      getHook().setEtag(getResult.value.etag);
    });

    // Another user saves, making our etag stale
    await repo.save("wf-force-fail", makeGraph("wf-force-fail", "Other"), getResult.value.etag);

    // Our save conflicts
    await act(async () => {
      await getHook().save("wf-force-fail", makeGraph("wf-force-fail", "My edit"));
    });

    // Spy on save to make force-save fail
    vi.spyOn(repo, "save").mockResolvedValueOnce({
      ok: false,
      error: { code: "NETWORK", message: "timeout" },
    });

    const previousEtag = screen.getByTestId("etag").textContent;

    const user = userEvent.setup();

    // Click Force save — should not crash even when save fails
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Force save" }));
    });

    // ETag should remain unchanged since force-save failed
    expect(screen.getByTestId("saving").textContent).toBe("false");
    expect(screen.getByTestId("etag").textContent).toBe(previousEtag);
  });
});
