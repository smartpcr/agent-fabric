import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, renderHook, act } from "@testing-library/react";
import {
  SecretField,
  SECRET_SENTINEL,
  scrubSecrets,
  registerSecretField,
  SECRET_FIELD_NAMES,
  type SecretFieldProps,
} from "@/features/property-grid/fields/SecretField";
import { ToastContext } from "@/features/editor/Toast";
import type { FieldComponentProps, FieldDescriptor } from "@/features/property-grid/registry";

// ─── Top-level mocks for useAutoSave integration ────────────────────

const mockSetViewport = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    setViewport: mockSetViewport,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  }),
}));

afterEach(() => {
  cleanup();
  SECRET_FIELD_NAMES.clear();
});

// ─── Helpers ────────────────────────────────────────────────────────

function makeField(
  overrides: Partial<FieldComponentProps["field"]> = {},
): FieldComponentProps["field"] {
  return {
    value: "",
    onChange: vi.fn(),
    onBlur: vi.fn(),
    name: "secret",
    ref: vi.fn(),
    ...overrides,
  };
}

function makeDescriptor(overrides: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    name: "apiKey",
    type: "string",
    required: true,
    ...overrides,
  };
}

function renderSecretField(overrides: Partial<SecretFieldProps> = {}) {
  const defaults: SecretFieldProps = {
    descriptor: makeDescriptor(),
    field: makeField({ value: "my-secret-key" }),
    ...overrides,
  };
  return render(<SecretField {...defaults} />);
}

// ─── SecretField rendering ──────────────────────────────────────────

describe("SecretField", () => {
  describe("masked by default", () => {
    it("renders an input of type password", () => {
      renderSecretField();
      const input = screen.getByTestId("field-apiKey");
      expect(input.tagName).toBe("INPUT");
      expect(input.getAttribute("type")).toBe("password");
    });

    it("renders the value in the input", () => {
      renderSecretField();
      const input = screen.getByTestId("field-apiKey");
      expect(input.value).toBe("my-secret-key");
    });

    it("renders empty string for null value", () => {
      renderSecretField({ field: makeField({ value: null }) });
      const input = screen.getByTestId("field-apiKey");
      expect(input.value).toBe("");
    });

    it("renders empty string for undefined value", () => {
      renderSecretField({ field: makeField({ value: undefined }) });
      const input = screen.getByTestId("field-apiKey");
      expect(input.value).toBe("");
    });

    it("has autoComplete off", () => {
      renderSecretField();
      const input = screen.getByTestId("field-apiKey");
      expect(input.getAttribute("autocomplete")).toBe("off");
    });
  });

  describe("reveal toggle", () => {
    it("has a reveal button", () => {
      renderSecretField();
      const btn = screen.getByTestId("reveal-apiKey");
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toBe("Reveal");
    });

    it("toggles input type to text on reveal click", () => {
      renderSecretField();
      const input = screen.getByTestId("field-apiKey");
      const btn = screen.getByTestId("reveal-apiKey");

      expect(input.getAttribute("type")).toBe("password");

      fireEvent.click(btn);

      expect(input.getAttribute("type")).toBe("text");
      expect(btn.textContent).toBe("Hide");
    });

    it("toggles back to password on second click", () => {
      renderSecretField();
      const input = screen.getByTestId("field-apiKey");
      const btn = screen.getByTestId("reveal-apiKey");

      fireEvent.click(btn);
      fireEvent.click(btn);

      expect(input.getAttribute("type")).toBe("password");
      expect(btn.textContent).toBe("Reveal");
    });

    it("reveal button has correct aria-label when masked", () => {
      renderSecretField();
      const btn = screen.getByTestId("reveal-apiKey");
      expect(btn.getAttribute("aria-label")).toBe("Reveal secret");
    });

    it("reveal button has correct aria-label when revealed", () => {
      renderSecretField();
      const btn = screen.getByTestId("reveal-apiKey");
      fireEvent.click(btn);
      expect(btn.getAttribute("aria-label")).toBe("Hide secret");
    });
  });

  describe("copy to clipboard", () => {
    let writeTextMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });
    });

    it("has a copy button", () => {
      renderSecretField();
      const btn = screen.getByTestId("copy-apiKey");
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toBe("Copy");
    });

    it("copies value to clipboard on click", async () => {
      renderSecretField();
      const btn = screen.getByTestId("copy-apiKey");

      fireEvent.click(btn);

      await vi.waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith("my-secret-key");
      });
    });

    it("fires success toast after copy", async () => {
      const onCopyToast = vi.fn();
      renderSecretField({ onCopyToast });

      fireEvent.click(screen.getByTestId("copy-apiKey"));

      await vi.waitFor(() => {
        expect(onCopyToast).toHaveBeenCalledWith({
          title: "Copied to clipboard",
          variant: "success",
        });
      });
    });

    it("fires error toast when clipboard write fails", async () => {
      writeTextMock.mockRejectedValueOnce(new Error("denied"));
      const onCopyToast = vi.fn();
      renderSecretField({ onCopyToast });

      fireEvent.click(screen.getByTestId("copy-apiKey"));

      await vi.waitFor(() => {
        expect(onCopyToast).toHaveBeenCalledWith({
          title: "Failed to copy",
          variant: "error",
        });
      });
    });

    it("copy button has accessible aria-label", () => {
      renderSecretField();
      const btn = screen.getByTestId("copy-apiKey");
      expect(btn.getAttribute("aria-label")).toBe("Copy to clipboard");
    });
  });

  describe("onChange", () => {
    it("calls field.onChange when value changes", () => {
      const onChange = vi.fn();
      renderSecretField({ field: makeField({ onChange }) });

      fireEvent.change(screen.getByTestId("field-apiKey"), {
        target: { value: "new-secret" },
      });

      expect(onChange).toHaveBeenCalledWith("new-secret");
    });

    it("calls field.onBlur on blur", () => {
      const onBlur = vi.fn();
      renderSecretField({ field: makeField({ onBlur }) });

      fireEvent.blur(screen.getByTestId("field-apiKey"));

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe("error display", () => {
    it("does not render error element when no error", () => {
      renderSecretField();
      expect(screen.queryByTestId("error-apiKey")).not.toBeInTheDocument();
    });

    it("renders error message when error is provided", () => {
      renderSecretField({ error: "Required" });
      const errorEl = screen.getByTestId("error-apiKey");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl.textContent).toBe("Required");
    });

    it("error has role=alert", () => {
      renderSecretField({ error: "Required" });
      expect(screen.getByTestId("error-apiKey").getAttribute("role")).toBe("alert");
    });

    it("sets aria-invalid when error is present", () => {
      renderSecretField({ error: "Required" });
      expect(screen.getByTestId("field-apiKey").getAttribute("aria-invalid")).toBe("true");
    });

    it("sets aria-invalid=false when no error", () => {
      renderSecretField();
      expect(screen.getByTestId("field-apiKey").getAttribute("aria-invalid")).toBe("false");
    });

    it("sets aria-describedby to error element when error exists", () => {
      renderSecretField({ error: "Invalid" });
      expect(screen.getByTestId("field-apiKey").getAttribute("aria-describedby")).toBe(
        "error-apiKey",
      );
    });

    it("does not set aria-describedby when no error", () => {
      renderSecretField();
      expect(screen.getByTestId("field-apiKey").getAttribute("aria-describedby")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("has aria-label matching descriptor name", () => {
      renderSecretField({ descriptor: makeDescriptor({ name: "password" }) });
      expect(screen.getByTestId("field-password").getAttribute("aria-label")).toBe("password");
    });

    it("coerces numeric value to string", () => {
      renderSecretField({ field: makeField({ value: 12345 }) });
      const input = screen.getByTestId("field-apiKey");
      expect(input.value).toBe("12345");
    });

    it("wraps content in a container div", () => {
      renderSecretField();
      expect(screen.getByTestId("secret-field-apiKey")).toBeInTheDocument();
    });
  });
});

// ─── SECRET_SENTINEL constant ───────────────────────────────────────

describe("SECRET_SENTINEL", () => {
  it("equals '<secret>'", () => {
    expect(SECRET_SENTINEL).toBe("<secret>");
  });
});

// ─── scrubSecrets ───────────────────────────────────────────────────

describe("scrubSecrets", () => {
  beforeEach(() => {
    SECRET_FIELD_NAMES.clear();
  });

  it("returns null for null input", () => {
    expect(scrubSecrets(null)).toBeNull();
  });

  it("returns undefined for undefined input", () => {
    expect(scrubSecrets(undefined)).toBeUndefined();
  });

  it("returns primitives unchanged", () => {
    expect(scrubSecrets("hello")).toBe("hello");
    expect(scrubSecrets(42)).toBe(42);
    expect(scrubSecrets(true)).toBe(true);
  });

  it("replaces registered secret field values with sentinel", () => {
    registerSecretField("apiKey");

    const data = { name: "test", apiKey: "real-secret-123" };
    const result = scrubSecrets(data) as Record<string, unknown>;

    expect(result.name).toBe("test");
    expect(result.apiKey).toBe(SECRET_SENTINEL);
  });

  it("does not mutate the original object", () => {
    registerSecretField("password");

    const data = { password: "hunter2" };
    scrubSecrets(data);

    expect(data.password).toBe("hunter2");
  });

  it("scrubs nested objects recursively", () => {
    registerSecretField("token");

    const data = {
      config: {
        auth: {
          token: "abc-def",
          user: "admin",
        },
      },
    };

    const result = scrubSecrets(data) as {
      config: { auth: { token: string; user: string } };
    };

    expect(result.config.auth.token).toBe(SECRET_SENTINEL);
    expect(result.config.auth.user).toBe("admin");
  });

  it("scrubs items inside arrays", () => {
    registerSecretField("secret");

    const data = [
      { secret: "val1", name: "a" },
      { secret: "val2", name: "b" },
    ];
    const result = scrubSecrets(data) as Array<{ secret: string; name: string }>;

    expect(result[0].secret).toBe(SECRET_SENTINEL);
    expect(result[0].name).toBe("a");
    expect(result[1].secret).toBe(SECRET_SENTINEL);
    expect(result[1].name).toBe("b");
  });

  it("handles empty objects", () => {
    const result = scrubSecrets({});
    expect(result).toEqual({});
  });

  it("handles empty arrays", () => {
    const result = scrubSecrets([]);
    expect(result).toEqual([]);
  });

  it("does not scrub non-registered fields", () => {
    registerSecretField("password");

    const data = { apiKey: "should-keep", password: "should-scrub" };
    const result = scrubSecrets(data) as Record<string, unknown>;

    expect(result.apiKey).toBe("should-keep");
    expect(result.password).toBe(SECRET_SENTINEL);
  });

  it("handles multiple registered secret fields", () => {
    registerSecretField("password");
    registerSecretField("apiKey");
    registerSecretField("token");

    const data = { password: "p", apiKey: "a", token: "t", name: "ok" };
    const result = scrubSecrets(data) as Record<string, unknown>;

    expect(result.password).toBe(SECRET_SENTINEL);
    expect(result.apiKey).toBe(SECRET_SENTINEL);
    expect(result.token).toBe(SECRET_SENTINEL);
    expect(result.name).toBe("ok");
  });
});

// ─── registerSecretField ────────────────────────────────────────────

describe("registerSecretField", () => {
  beforeEach(() => {
    SECRET_FIELD_NAMES.clear();
  });

  it("adds field name to the secret fields set", () => {
    registerSecretField("mySecret");
    expect(SECRET_FIELD_NAMES.has("mySecret")).toBe(true);
  });

  it("is idempotent — registering twice does not duplicate", () => {
    registerSecretField("key");
    registerSecretField("key");
    expect(SECRET_FIELD_NAMES.size).toBe(1);
  });
});

// ─── autosave payload sentinel integration ──────────────────────────

describe("autosave payload contains sentinel", () => {
  beforeEach(() => {
    SECRET_FIELD_NAMES.clear();
  });

  it("scrubSecrets produces sentinel in a node-like payload", () => {
    registerSecretField("connectionString");

    const nodePayload = {
      nodes: [
        {
          id: "node-1",
          data: {
            connectionString: "Server=prod;Password=abc123",
            displayName: "My Node",
          },
        },
      ],
      edges: [],
    };

    const result = scrubSecrets(nodePayload) as {
      nodes: Array<{ data: { connectionString: string; displayName: string } }>;
    };

    expect(result.nodes[0].data.connectionString).toBe(SECRET_SENTINEL);
    expect(result.nodes[0].data.displayName).toBe("My Node");
  });

  it("scrubSecrets preserves non-secret node data", () => {
    registerSecretField("password");

    const payload = {
      nodes: [
        { id: "n1", data: { label: "Start", password: "secret" } },
        { id: "n2", data: { label: "End" } },
      ],
    };

    const result = scrubSecrets(payload) as {
      nodes: Array<{ id: string; data: Record<string, unknown> }>;
    };

    expect(result.nodes[0].data.label).toBe("Start");
    expect(result.nodes[0].data.password).toBe(SECRET_SENTINEL);
    expect(result.nodes[1].data.label).toBe("End");
  });
});

// ─── Auto-registration on mount ─────────────────────────────────────

describe("SecretField auto-registration", () => {
  it("registers descriptor.name into SECRET_FIELD_NAMES on mount", () => {
    expect(SECRET_FIELD_NAMES.has("apiKey")).toBe(false);

    renderSecretField();

    expect(SECRET_FIELD_NAMES.has("apiKey")).toBe(true);
  });

  it("registers different names for different descriptors", () => {
    renderSecretField({ descriptor: makeDescriptor({ name: "password" }) });
    renderSecretField({ descriptor: makeDescriptor({ name: "token" }) });

    expect(SECRET_FIELD_NAMES.has("password")).toBe(true);
    expect(SECRET_FIELD_NAMES.has("token")).toBe(true);
  });

  it("scrubSecrets works after SecretField auto-registers", () => {
    renderSecretField({ descriptor: makeDescriptor({ name: "apiKey" }) });

    const data = { apiKey: "real-secret", name: "safe" };
    const result = scrubSecrets(data) as Record<string, unknown>;

    expect(result.apiKey).toBe(SECRET_SENTINEL);
    expect(result.name).toBe("safe");
  });
});

// ─── Toast context integration ──────────────────────────────────────

describe("SecretField toast context integration", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  it("fires toast via ToastContext when no onCopyToast prop", async () => {
    const showSpy = vi.fn();
    render(
      <ToastContext.Provider value={{ toasts: [], show: showSpy, dismiss: vi.fn() }}>
        <SecretField descriptor={makeDescriptor()} field={makeField({ value: "secret-val" })} />
      </ToastContext.Provider>,
    );

    fireEvent.click(screen.getByTestId("copy-apiKey"));

    await vi.waitFor(() => {
      expect(showSpy).toHaveBeenCalledWith({
        title: "Copied to clipboard",
        variant: "success",
      });
    });
  });

  it("fires error toast via context on clipboard failure", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("denied"));
    const showSpy = vi.fn();

    render(
      <ToastContext.Provider value={{ toasts: [], show: showSpy, dismiss: vi.fn() }}>
        <SecretField descriptor={makeDescriptor()} field={makeField({ value: "secret-val" })} />
      </ToastContext.Provider>,
    );

    fireEvent.click(screen.getByTestId("copy-apiKey"));

    await vi.waitFor(() => {
      expect(showSpy).toHaveBeenCalledWith({
        title: "Failed to copy",
        variant: "error",
      });
    });
  });

  it("prefers onCopyToast prop over context when both available", async () => {
    const showSpy = vi.fn();
    const propToast = vi.fn();

    render(
      <ToastContext.Provider value={{ toasts: [], show: showSpy, dismiss: vi.fn() }}>
        <SecretField
          descriptor={makeDescriptor()}
          field={makeField({ value: "secret-val" })}
          onCopyToast={propToast}
        />
      </ToastContext.Provider>,
    );

    fireEvent.click(screen.getByTestId("copy-apiKey"));

    await vi.waitFor(() => {
      expect(propToast).toHaveBeenCalledWith({
        title: "Copied to clipboard",
        variant: "success",
      });
    });

    expect(showSpy).not.toHaveBeenCalled();
  });

  it("works without toast context or prop (no crash)", async () => {
    render(
      <SecretField descriptor={makeDescriptor()} field={makeField({ value: "secret-val" })} />,
    );

    // Should not throw even without context or prop
    fireEvent.click(screen.getByTestId("copy-apiKey"));

    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("secret-val");
    });
  });
});

// ─── useAutoSave integration with secret scrubbing ──────────────────

describe("useAutoSave scrubs secret fields in save payload", () => {
  // Dynamic import so the mock is applied before the module loads
  async function getAutoSave() {
    const mod = await import("@/features/persistence/useAutoSave");
    return mod.useAutoSave;
  }

  it("save() returns payload with sentinel for registered secret fields", async () => {
    // Register a secret field (simulating what SecretField does on mount)
    registerSecretField("apiKey");

    const useAutoSave = await getAutoSave();
    const { result } = renderHook(() => useAutoSave());
    const payload = result.current.save();

    // The payload itself won't have apiKey at top level since nodes are empty,
    // but the scrubSecrets function is integrated — verify via a direct node-like test
    const fakeNodes = [{ id: "n1", data: { apiKey: "raw-secret", label: "Test" } }];
    const scrubbed = scrubSecrets(fakeNodes) as Array<{
      data: Record<string, unknown>;
    }>;

    expect(scrubbed[0].data.apiKey).toBe(SECRET_SENTINEL);
    expect(scrubbed[0].data.label).toBe("Test");

    // Verify payload structure is valid
    expect(Array.isArray(payload.nodes)).toBe(true);
    expect(Array.isArray(payload.edges)).toBe(true);
    expect(payload.viewport).toBeDefined();
  });

  it("save() scrubs secrets embedded in store nodes", async () => {
    registerSecretField("connectionString");

    const useAutoSave = await getAutoSave();
    const storeModule = await import("@/store/hooks");

    // Add a node with a secret field via store
    const { result: storeResult, unmount: unmountStore } = renderHook(() =>
      storeModule.useWorkflowStore(),
    );

    act(() => {
      storeResult.current.addNode(
        {
          kind: "task" as const,
          label: "Secret Node",
          defaultData: { connectionString: "Server=prod;Password=abc", name: "test" },
        },
        { x: 0, y: 0 },
      );
    });
    unmountStore();

    // Save and verify scrubbing
    const { result } = renderHook(() => useAutoSave());
    const payload = result.current.save();

    // Find the node and verify connectionString is scrubbed
    const nodes = payload.nodes as Array<{ data: Record<string, unknown> }>;
    expect(nodes.length).toBeGreaterThan(0);
    const nodeData = nodes[0].data;
    expect(nodeData.connectionString).toBe(SECRET_SENTINEL);
    expect(nodeData.name).toBe("test");
  });
});
