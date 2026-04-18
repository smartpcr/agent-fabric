import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import {
  CodeField,
  CodeFieldSkeleton,
  FallbackTextarea,
  extractLanguage,
  configureReadOnlyWorker,
} from "@/features/property-grid/fields/CodeField";
import type { FieldComponentProps } from "@/features/property-grid/registry";
import type { FieldDescriptor } from "@/features/property-grid/introspect";

// ─── Mock @monaco-editor/react ──────────────────────────────────────

const mockState = vi.hoisted(() => ({
  capturedBeforeMount: undefined as (() => void) | undefined,
}));

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
vi.mock("@monaco-editor/react", () => ({
  default: function MockMonacoEditor(props: any) {
    // Capture and invoke the beforeMount callback if provided
    if (typeof props.beforeMount === "function") {
      mockState.capturedBeforeMount = props.beforeMount as () => void;
      (props.beforeMount as () => void)();
    }
    return (
      <div data-testid="mock-monaco">
        <textarea
          data-testid="mock-monaco-textarea"
          value={props.value as string}
          onChange={(e) => {
            (props.onChange as (v: string) => void)(e.target.value);
          }}
          style={{ height: props.height as string }}
        />
        <span data-testid="mock-monaco-language">{props.language as string}</span>
      </div>
    );
  },
}));
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */

beforeEach(() => {
  mockState.capturedBeforeMount = undefined;
  // Clean up MonacoEnvironment between tests
  delete (globalThis as Record<string, unknown>).MonacoEnvironment;
});

afterEach(cleanup);

// ─── Helpers ────────────────────────────────────────────────────────

function makeField(
  overrides: Partial<FieldComponentProps["field"]> = {},
): FieldComponentProps["field"] {
  return {
    value: "",
    onChange: vi.fn(),
    onBlur: vi.fn(),
    name: "code",
    ref: vi.fn(),
    ...overrides,
  };
}

function makeDescriptor(overrides: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return {
    name: "code",
    type: "string",
    required: false,
    ...overrides,
  };
}

// ─── extractLanguage ────────────────────────────────────────────────

describe("extractLanguage", () => {
  it("returns 'plaintext' when description is undefined", () => {
    expect(extractLanguage(undefined)).toBe("plaintext");
  });

  it("returns 'plaintext' when description is empty string", () => {
    expect(extractLanguage("")).toBe("plaintext");
  });

  it("returns 'plaintext' when description is plain text", () => {
    expect(extractLanguage("Enter your code here")).toBe("plaintext");
  });

  it("extracts language from single-quote JSON-like description", () => {
    expect(extractLanguage("{ language: 'javascript' }")).toBe("javascript");
  });

  it("extracts language from double-quote JSON description", () => {
    expect(extractLanguage('{ "language": "python" }')).toBe("python");
  });

  it("extracts language from JSON with extra fields", () => {
    expect(extractLanguage('{ "language": "typescript", "readonly": true }')).toBe("typescript");
  });

  it("returns 'plaintext' when JSON has no language field", () => {
    expect(extractLanguage('{ "type": "code" }')).toBe("plaintext");
  });

  it("returns 'plaintext' when language value is not a string", () => {
    expect(extractLanguage('{ "language": 42 }')).toBe("plaintext");
  });
});

// ─── CodeFieldSkeleton ──────────────────────────────────────────────

describe("CodeFieldSkeleton", () => {
  it("renders with correct test id", () => {
    render(<CodeFieldSkeleton name="myCode" height={200} />);
    expect(screen.getByTestId("code-skeleton-myCode")).toBeInTheDocument();
  });

  it("has role=status for loading state", () => {
    render(<CodeFieldSkeleton name="myCode" height={200} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has accessible loading label", () => {
    render(<CodeFieldSkeleton name="myCode" height={200} />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Loading code editor");
  });

  it("renders loading text", () => {
    render(<CodeFieldSkeleton name="myCode" height={200} />);
    expect(screen.getByText("Loading code editor")).toBeInTheDocument();
  });

  it("respects height prop", () => {
    render(<CodeFieldSkeleton name="myCode" height={300} />);
    const skeleton = screen.getByTestId("code-skeleton-myCode");
    expect(skeleton.style.height).toBe("300px");
  });
});

// ─── FallbackTextarea ───────────────────────────────────────────────

describe("FallbackTextarea", () => {
  it("renders a textarea with the value", () => {
    render(
      <FallbackTextarea
        value="hello world"
        onChange={vi.fn()}
        onBlur={vi.fn()}
        name="code"
        fieldName="myCode"
        height={200}
      />,
    );

    const textarea = screen.getByTestId("code-fallback-myCode");
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveDisplayValue("hello world");
  });

  it("calls onChange when text changes", () => {
    const onChange = vi.fn();
    render(
      <FallbackTextarea
        value=""
        onChange={onChange}
        onBlur={vi.fn()}
        name="code"
        fieldName="myCode"
        height={200}
      />,
    );

    fireEvent.change(screen.getByTestId("code-fallback-myCode"), {
      target: { value: "new text" },
    });

    expect(onChange).toHaveBeenCalledWith("new text");
  });

  it("calls onBlur when textarea loses focus", () => {
    const onBlur = vi.fn();
    render(
      <FallbackTextarea
        value=""
        onChange={vi.fn()}
        onBlur={onBlur}
        name="code"
        fieldName="myCode"
        height={200}
      />,
    );

    fireEvent.blur(screen.getByTestId("code-fallback-myCode"));
    expect(onBlur).toHaveBeenCalled();
  });

  it("has monospace font family", () => {
    render(
      <FallbackTextarea
        value=""
        onChange={vi.fn()}
        onBlur={vi.fn()}
        name="code"
        fieldName="myCode"
        height={200}
      />,
    );

    const textarea = screen.getByTestId("code-fallback-myCode");
    expect(textarea.style.fontFamily).toBe("monospace");
  });

  it("respects height prop", () => {
    render(
      <FallbackTextarea
        value=""
        onChange={vi.fn()}
        onBlur={vi.fn()}
        name="code"
        fieldName="myCode"
        height={400}
      />,
    );

    const textarea = screen.getByTestId("code-fallback-myCode");
    expect(textarea.style.height).toBe("400px");
  });

  it("renders error message when error is provided", () => {
    render(
      <FallbackTextarea
        value=""
        onChange={vi.fn()}
        onBlur={vi.fn()}
        name="code"
        fieldName="myCode"
        height={200}
        error="Invalid code"
      />,
    );

    const errorEl = screen.getByTestId("error-myCode");
    expect(errorEl).toBeInTheDocument();
    expect(errorEl.textContent).toBe("Invalid code");
    expect(errorEl.getAttribute("role")).toBe("alert");
  });

  it("does not render error when no error", () => {
    render(
      <FallbackTextarea
        value=""
        onChange={vi.fn()}
        onBlur={vi.fn()}
        name="code"
        fieldName="myCode"
        height={200}
      />,
    );

    expect(screen.queryByTestId("error-myCode")).not.toBeInTheDocument();
  });

  it("has aria-invalid when error exists", () => {
    render(
      <FallbackTextarea
        value=""
        onChange={vi.fn()}
        onBlur={vi.fn()}
        name="code"
        fieldName="myCode"
        height={200}
        error="Bad"
      />,
    );

    expect(screen.getByTestId("code-fallback-myCode").getAttribute("aria-invalid")).toBe("true");
  });

  it("has aria-describedby pointing to error", () => {
    render(
      <FallbackTextarea
        value=""
        onChange={vi.fn()}
        onBlur={vi.fn()}
        name="code"
        fieldName="myCode"
        height={200}
        error="Bad"
      />,
    );

    expect(screen.getByTestId("code-fallback-myCode").getAttribute("aria-describedby")).toBe(
      "error-myCode",
    );
  });
});

// ─── CodeField (with disableMonaco — textarea fallback) ──────────────

describe("CodeField (fallback mode)", () => {
  it("renders textarea fallback when disableMonaco is true", () => {
    render(
      <CodeField
        descriptor={makeDescriptor()}
        field={makeField({ value: "const x = 1;" })}
        disableMonaco
      />,
    );

    const textarea = screen.getByTestId("code-fallback-code");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveDisplayValue("const x = 1;");
  });

  it("calls field.onChange when fallback textarea changes", () => {
    const onChange = vi.fn();
    render(
      <CodeField descriptor={makeDescriptor()} field={makeField({ onChange })} disableMonaco />,
    );

    fireEvent.change(screen.getByTestId("code-fallback-code"), {
      target: { value: "new code" },
    });

    expect(onChange).toHaveBeenCalledWith("new code");
  });

  it("renders error in fallback mode", () => {
    render(
      <CodeField
        descriptor={makeDescriptor()}
        field={makeField()}
        disableMonaco
        error="Syntax error"
      />,
    );

    const errorEl = screen.getByTestId("error-code");
    expect(errorEl.textContent).toBe("Syntax error");
  });

  it("uses custom height in fallback mode", () => {
    render(
      <CodeField descriptor={makeDescriptor()} field={makeField()} disableMonaco height={500} />,
    );

    const textarea = screen.getByTestId("code-fallback-code");
    expect(textarea.style.height).toBe("500px");
  });

  it("handles null value gracefully", () => {
    render(
      <CodeField descriptor={makeDescriptor()} field={makeField({ value: null })} disableMonaco />,
    );

    const textarea = screen.getByTestId("code-fallback-code");
    expect(textarea).toHaveDisplayValue("");
  });

  it("handles undefined value gracefully", () => {
    render(
      <CodeField
        descriptor={makeDescriptor()}
        field={makeField({ value: undefined })}
        disableMonaco
      />,
    );

    const textarea = screen.getByTestId("code-fallback-code");
    expect(textarea).toHaveDisplayValue("");
  });
});

// ─── CodeField (lazy Monaco via mock) ────────────────────────────────

describe("CodeField (lazy Monaco)", () => {
  it("renders the lazy-loaded Monaco editor", async () => {
    render(
      <CodeField
        descriptor={makeDescriptor()}
        field={makeField({ value: "console.log('hi');" })}
      />,
    );

    // Wait for lazy load to resolve
    await waitFor(() => {
      expect(screen.getByTestId("code-editor-code")).toBeInTheDocument();
    });

    // Mock Monaco renders our textarea
    expect(screen.getByTestId("mock-monaco")).toBeInTheDocument();
  });

  it("passes value to Monaco editor", async () => {
    render(<CodeField descriptor={makeDescriptor()} field={makeField({ value: "let a = 42;" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco-textarea")).toBeInTheDocument();
    });

    expect(screen.getByTestId("mock-monaco-textarea")).toHaveDisplayValue("let a = 42;");
  });

  it("extracts language from descriptor description", async () => {
    render(
      <CodeField
        descriptor={makeDescriptor({ description: "{ language: 'javascript' }" })}
        field={makeField({ value: "" })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco-language")).toBeInTheDocument();
    });

    expect(screen.getByTestId("mock-monaco-language").textContent).toBe("javascript");
  });

  it("defaults language to plaintext when no description", async () => {
    render(<CodeField descriptor={makeDescriptor()} field={makeField({ value: "" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco-language")).toBeInTheDocument();
    });

    expect(screen.getByTestId("mock-monaco-language").textContent).toBe("plaintext");
  });

  it("propagates onChange from Monaco to field.onChange", async () => {
    const onChange = vi.fn();
    render(<CodeField descriptor={makeDescriptor()} field={makeField({ onChange, value: "" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco-textarea")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("mock-monaco-textarea"), {
      target: { value: "updated" },
    });

    expect(onChange).toHaveBeenCalledWith("updated");
  });

  it("renders error when error is provided", async () => {
    render(
      <CodeField
        descriptor={makeDescriptor()}
        field={makeField({ value: "" })}
        error="Parse error"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error-code")).toBeInTheDocument();
    });

    expect(screen.getByTestId("error-code").textContent).toBe("Parse error");
    expect(screen.getByTestId("error-code").getAttribute("role")).toBe("alert");
  });

  it("does not render error when no error", async () => {
    render(<CodeField descriptor={makeDescriptor()} field={makeField({ value: "" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("error-code")).not.toBeInTheDocument();
  });

  it("shows skeleton placeholder during lazy load", () => {
    // Before the lazy component resolves, the Suspense fallback should render.
    // With vi.mock the module resolves synchronously, so we test the skeleton
    // component directly to prove it renders correctly.
    render(<CodeFieldSkeleton name="code" height={200} />);
    expect(screen.getByTestId("code-skeleton-code")).toBeInTheDocument();
    expect(screen.getByText("Loading code editor")).toBeInTheDocument();
  });

  it("uses python language from description", async () => {
    render(
      <CodeField
        descriptor={makeDescriptor({ description: '{ "language": "python" }' })}
        field={makeField({ value: "print('hi')" })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco-language")).toBeInTheDocument();
    });

    expect(screen.getByTestId("mock-monaco-language").textContent).toBe("python");
  });
});

// ─── Height responsiveness ──────────────────────────────────────────

describe("CodeField height", () => {
  it("defaults to 200px height in fallback mode", () => {
    render(<CodeField descriptor={makeDescriptor()} field={makeField()} disableMonaco />);

    const textarea = screen.getByTestId("code-fallback-code");
    expect(textarea.style.height).toBe("200px");
  });

  it("applies custom height in fallback mode", () => {
    render(
      <CodeField descriptor={makeDescriptor()} field={makeField()} disableMonaco height={400} />,
    );

    const textarea = screen.getByTestId("code-fallback-code");
    expect(textarea.style.height).toBe("400px");
  });

  it("applies custom height to Monaco editor", async () => {
    render(
      <CodeField descriptor={makeDescriptor()} field={makeField({ value: "" })} height={350} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco-textarea")).toBeInTheDocument();
    });

    // The mock Monaco uses the height prop on the textarea
    expect(screen.getByTestId("mock-monaco-textarea").style.height).toBe("350px");
  });
});

// ─── Read-only worker configuration ─────────────────────────────────

describe("configureReadOnlyWorker", () => {
  it("sets globalThis.MonacoEnvironment when not already present", () => {
    expect((globalThis as Record<string, unknown>).MonacoEnvironment).toBeUndefined();

    configureReadOnlyWorker();

    const env = (globalThis as Record<string, unknown>).MonacoEnvironment as Record<
      string,
      unknown
    >;
    expect(env).toBeDefined();
    expect(typeof env.getWorker).toBe("function");
  });

  it("updates existing MonacoEnvironment.getWorker", () => {
    const originalGetWorker = vi.fn();
    (globalThis as Record<string, unknown>).MonacoEnvironment = {
      getWorker: originalGetWorker,
    };

    configureReadOnlyWorker();

    const env = (globalThis as Record<string, unknown>).MonacoEnvironment as Record<
      string,
      unknown
    >;
    expect(env.getWorker).not.toBe(originalGetWorker);
    expect(typeof env.getWorker).toBe("function");
  });

  it("is invoked via beforeMount when Monaco editor renders", async () => {
    render(<CodeField descriptor={makeDescriptor()} field={makeField({ value: "" })} />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-monaco")).toBeInTheDocument();
    });

    // The mock captures and invokes beforeMount
    expect(mockState.capturedBeforeMount).toBeDefined();

    // After beforeMount ran, MonacoEnvironment should be configured
    const env = (globalThis as Record<string, unknown>).MonacoEnvironment as Record<
      string,
      unknown
    >;
    expect(env).toBeDefined();
    expect(typeof env.getWorker).toBe("function");
  });

  it("beforeMount is not called in fallback mode", () => {
    render(<CodeField descriptor={makeDescriptor()} field={makeField()} disableMonaco />);

    // In fallback mode, Monaco is not rendered so beforeMount is never invoked
    expect(mockState.capturedBeforeMount).toBeUndefined();
  });

  it("getWorker callback creates a Worker from a Blob when MonacoEnvironment exists", () => {
    // Mock Worker since it's not available in jsdom
    const WorkerMock = vi.fn();
    vi.stubGlobal("Worker", WorkerMock);

    (globalThis as Record<string, unknown>).MonacoEnvironment = {
      getWorker: vi.fn(),
    };

    configureReadOnlyWorker();

    const env = (globalThis as Record<string, unknown>).MonacoEnvironment as {
      getWorker: () => unknown;
    };
    env.getWorker();
    expect(WorkerMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("getWorker callback creates a Worker from a Blob when MonacoEnvironment does not exist", () => {
    // Mock Worker since it's not available in jsdom
    const WorkerMock = vi.fn();
    vi.stubGlobal("Worker", WorkerMock);

    delete (globalThis as Record<string, unknown>).MonacoEnvironment;

    configureReadOnlyWorker();

    const env = (globalThis as Record<string, unknown>).MonacoEnvironment as {
      getWorker: () => unknown;
    };
    env.getWorker();
    expect(WorkerMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
