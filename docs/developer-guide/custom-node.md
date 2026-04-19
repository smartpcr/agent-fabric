# Register a Custom Node — Developer Tutorial

This guide shows you how to add a new node type to the Agent Fabric
workflow editor: define a `NodeSpec`, register it with the `NodeRegistry`,
author a React component, and test it.

---

## Overview

Every node in the editor is driven by a **`NodeSpec`** — a declarative
definition that describes the node's identity, ports, property schema,
and defaults. The editor's runtime components (palette, canvas, property
grid) all consume the registry to render and validate nodes.

### Architecture at a glance

```
NodeSpec (domain model)
  ↓ register
NodeRegistry (runtime registry)
  ↓ consumed by
Palette / Canvas / Property Grid
```

---

## 1. Define a `NodeSpec`

Create a new spec file under `src/registry/builtins/`. A `NodeSpec`
requires these fields:

| Field            | Type         | Description                                          |
| ---------------- | ------------ | ---------------------------------------------------- |
| `kind`           | `string`     | Unique identifier (e.g. `"http-request"`)            |
| `variant`        | `string?`    | Optional variant name                                |
| `category`       | `string`     | Palette grouping (e.g. `"integration"`)              |
| `label`          | `string`     | Human-readable display name                          |
| `icon`           | `string`     | Lucide icon name in kebab-case (e.g. `"globe"`)      |
| `ports`          | `PortSpec[]` | Input and output port definitions                    |
| `propertySchema` | `z.ZodType`  | Zod schema for the node's editable properties        |
| `defaultData`    | `TData`      | Default property values (must pass `propertySchema`) |
| `capabilities`   | `string[]`   | Feature flags (currently unused, pass `[]`)          |

### Example: `HttpRequestNode.spec.ts`

```typescript
// src/registry/builtins/HttpRequestNode.spec.ts
import { z } from "zod";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";
import type { NodeSpec } from "@/domain/models/nodeSpec";

const httpRequestSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  headers: z.array(z.string()).default([]),
  body: z.string().default(""),
  timeout: z.number().int().min(0).default(30),
});

type HttpRequestData = z.infer<typeof httpRequestSchema>;

export const HttpRequestNodeSpec: NodeSpec<HttpRequestData> = {
  kind: "http-request",
  category: "integration",
  label: "HTTP Request",
  icon: "globe",
  ports: [
    makeInputPort({
      id: "in",
      label: "Trigger",
      dataType: "any",
      required: true,
    }),
    makeOutputPort({
      id: "success",
      label: "Success",
      dataType: "any",
    }),
    makeOutputPort({
      id: "error",
      label: "Error",
      dataType: "any",
    }),
  ],
  propertySchema: httpRequestSchema,
  defaultData: {
    url: "https://example.com/api",
    method: "GET",
    headers: [],
    body: "",
    timeout: 30,
  },
  capabilities: [],
};
```

### Ports

Use the `makeInputPort()` and `makeOutputPort()` helpers from
`@/domain/models/port`:

```typescript
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

// Input port — receives data or triggers
makeInputPort({
  id: "in", // unique within this node
  label: "Input", // displayed in tooltip
  dataType: "any", // type-matching for connection validation
  cardinality: "single", // "single" (default) or "multi"
  required: true, // shows missing-indicator if unconnected
});

// Output port — sends data or signals
makeOutputPort({
  id: "out",
  label: "Output",
  dataType: "any",
});
```

### Property schema

The `propertySchema` is a standard [Zod](https://zod.dev/) schema. The
property grid introspects it to auto-generate form fields:

| Zod type                                  | Property Grid widget |
| ----------------------------------------- | -------------------- |
| `z.string()`                              | Text input           |
| `z.number()`                              | Number input         |
| `z.boolean()`                             | Toggle switch        |
| `z.enum([...])`                           | Dropdown select      |
| `z.array(z.string())`                     | Sortable list        |
| `z.object({...})`                         | Nested fieldset      |
| `z.string().describe("{ secret: true }")` | Masked secret input  |

### Validation

Use `validateSpec()` to verify your spec at development time:

```typescript
import { validateSpec } from "@/domain/models/nodeSpec";

validateSpec(HttpRequestNodeSpec);
// Throws if:
//   - Port IDs are duplicated
//   - defaultData doesn't match propertySchema
```

---

## 2. Register the Spec with `NodeRegistry`

Add your spec to the `registerBuiltins()` function in
`src/registry/registerBuiltins.ts`:

```typescript
// src/registry/registerBuiltins.ts
import { HttpRequestNodeSpec } from "@/registry/builtins/HttpRequestNode.spec";

const builtins = [
  StartNodeSpec,
  EndNodeSpec,
  TaskNodeSpec,
  // ... existing specs ...
  HttpRequestNodeSpec, // ← add here
] as const;
```

The `registerBuiltins()` function iterates over this array and calls
`registry.register(spec)` for each one. It also introspects the property
schema to auto-register any secret fields for autosave scrubbing.

### Registry API

The `NodeRegistry` class provides these methods:

```typescript
class NodeRegistry {
  register(spec: NodeSpec): void; // Add a spec (throws if duplicate kind)
  resolve(kind: string): NodeSpec; // Get spec or throw UnknownNodeKindError
  get(kind: string): NodeSpec | undefined; // Get spec or undefined
  has(kind: string): boolean; // Check if kind exists
  list(): readonly NodeSpec[]; // All registered specs
  freeze(): void; // Prevent further registration
}
```

### Store integration

The store's `registrySlice` also supports per-spec registration:

```typescript
store.getState().registerNodeSpec(HttpRequestNodeSpec);
```

This updates the `nodeSpecs` record in the store, making the spec
available to selectors like `selectNodeSpec()`.

---

## 3. Author the React Component

### Option A: Use `TaskNode` as the renderer (recommended)

If your node follows the standard layout (title bar + ports), the
existing `TaskNode` component already handles rendering dynamically based
on the registered `NodeSpec`. Just add an entry to the `nodeTypes` map:

```typescript
// src/features/canvas/nodeTypes.ts
import { TaskNode } from "@/features/nodes/TaskNode";

export const nodeTypes: NodeTypes = {
  // ... existing entries ...
  "http-request": TaskNode, // ← reuse TaskNode for standard layout
};
```

The `TaskNode` component:

1. Reads the `NodeSpec` from the store via `selectNodeSpec(state, type)`.
2. Renders the icon, title, and ports from the spec.
3. Delegates property editing to the `PropertyGrid`.

### Option B: Author a fully custom component

For non-standard visual layouts, create a new component:

```tsx
// src/features/nodes/HttpRequestNode.tsx
import { memo } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "@/features/nodes/BaseNode";
import { InputHandle } from "@/features/nodes/ports/InputHandle";
import { OutputHandle } from "@/features/nodes/ports/OutputHandle";
import { useWorkflowStore } from "@/store/hooks";
import { selectNodeSpec } from "@/store/selectors/graphSelectors";

interface HttpRequestData {
  readonly url: string;
  readonly method: string;
}

export const HttpRequestNode = memo(function HttpRequestNode({
  id,
  data,
  type,
  selected,
}: NodeProps) {
  const nodeData = data as HttpRequestData;
  const spec = useWorkflowStore((s) => selectNodeSpec(s, type ?? "http-request"));
  const selectNode = useWorkflowStore((s) => s.select);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const inPort = spec?.ports.find((p) => p.id === "in");
  const successPort = spec?.ports.find((p) => p.id === "success");
  const errorPort = spec?.ports.find((p) => p.id === "error");

  return (
    <BaseNode
      title={`${nodeData.method} ${nodeData.url}`}
      icon="globe"
      selected={selected}
      nodeId={id}
      onNodeFocus={() => selectNode(id, "replace")}
      onDelete={deleteSelected}
    >
      {inPort && (
        <InputHandle
          portSpec={inPort}
          position={Position.Top}
          nodeId={id}
          data-testid="http-handle-in"
        />
      )}
      {successPort && (
        <OutputHandle
          portSpec={successPort}
          position={Position.Bottom}
          nodeId={id}
          data-testid="http-handle-success"
        />
      )}
      {errorPort && (
        <OutputHandle
          portSpec={errorPort}
          position={Position.Right}
          nodeId={id}
          data-testid="http-handle-error"
        />
      )}
    </BaseNode>
  );
});
```

Then register it in `nodeTypes`:

```typescript
// src/features/canvas/nodeTypes.ts
import { HttpRequestNode } from "@/features/nodes/HttpRequestNode";

export const nodeTypes: NodeTypes = {
  // ... existing entries ...
  "http-request": HttpRequestNode,
};
```

### Key components reference

| Component      | File                                        | Purpose                                                  |
| -------------- | ------------------------------------------- | -------------------------------------------------------- |
| `BaseNode`     | `src/features/nodes/BaseNode.tsx`           | Shared node shell (header, icon, keyboard, a11y)         |
| `InputHandle`  | `src/features/nodes/ports/InputHandle.tsx`  | Renders an input port with tooltip and missing indicator |
| `OutputHandle` | `src/features/nodes/ports/OutputHandle.tsx` | Renders an output port with tooltip                      |
| `TaskNode`     | `src/features/nodes/TaskNode.tsx`           | Generic node renderer driven by `NodeSpec`               |

### Wrap with `React.memo`

All node components should be wrapped with `React.memo()` to prevent
unnecessary re-renders during pan/zoom. The built-in node components
already follow this pattern.

---

## 4. Test the Custom Node

### Unit test: Spec validation

```typescript
// tests/unit/registry/builtins/HttpRequestNode.test.ts
import { describe, it, expect } from "vitest";
import { HttpRequestNodeSpec } from "@/registry/builtins/HttpRequestNode.spec";
import { validateSpec } from "@/domain/models/nodeSpec";
import { NodeRegistry } from "@/registry/NodeRegistry";

describe("HttpRequestNodeSpec", () => {
  it("passes validateSpec()", () => {
    expect(() => validateSpec(HttpRequestNodeSpec)).not.toThrow();
  });

  it("has unique port IDs", () => {
    const ids = HttpRequestNodeSpec.ports.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers without error", () => {
    const registry = new NodeRegistry();
    expect(() => registry.register(HttpRequestNodeSpec)).not.toThrow();
  });

  it("defaultData conforms to property schema", () => {
    const result = HttpRequestNodeSpec.propertySchema.safeParse(HttpRequestNodeSpec.defaultData);
    expect(result.success).toBe(true);
  });

  it("has required input port", () => {
    const inPort = HttpRequestNodeSpec.ports.find((p) => p.id === "in");
    expect(inPort).toBeDefined();
    expect(inPort?.kind).toBe("in");
    expect(inPort?.required).toBe(true);
  });
});
```

### Integration test: Rendering

```tsx
// tests/integration/http-request-node.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HttpRequestNode } from "@/features/nodes/HttpRequestNode";

describe("HttpRequestNode", () => {
  it("renders the method and URL in the title", () => {
    render(
      <ReactFlowProvider>
        <HttpRequestNode
          id="n1"
          data={{ url: "https://api.example.com", method: "POST" }}
          type="http-request"
          selected={false}
        />
      </ReactFlowProvider>,
    );
    expect(screen.getByText(/POST.*api\.example\.com/)).toBeInTheDocument();
  });
});
```

### Existing test patterns

Study these existing tests for reference:

| Test file                                       | What it covers                       |
| ----------------------------------------------- | ------------------------------------ |
| `tests/unit/registry/builtins/TaskNode.test.ts` | Spec validation and port checks      |
| `tests/unit/registry/NodeRegistry.test.ts`      | Registry register/resolve/freeze     |
| `tests/unit/registry/registerBuiltins.test.ts`  | All builtins register successfully   |
| `tests/unit/features/nodes/TaskNode.test.tsx`   | Component rendering and interactions |

---

## 5. Checklist

Use this checklist to verify your custom node is complete:

- [ ] **Spec file** created in `src/registry/builtins/`
  - `kind` is unique and descriptive
  - `ports` have unique IDs and correct `kind` / `dataType`
  - `propertySchema` is a valid Zod schema
  - `defaultData` passes `propertySchema.safeParse()`
  - `validateSpec()` does not throw
- [ ] **Registered** in `src/registry/registerBuiltins.ts`
- [ ] **Node type** mapped in `src/features/canvas/nodeTypes.ts`
  - Either reuse `TaskNode` or create a custom `React.memo` component
- [ ] **Unit tests** cover spec validation and registry integration
- [ ] **Integration tests** cover component rendering (if custom component)
- [ ] **Build passes** — `npm run build`
- [ ] **Tests pass** — `npm run test`
- [ ] **Lint passes** — `npm run lint`

---

## Further Reading

- **Domain models**: `src/domain/models/nodeSpec.ts`, `src/domain/models/port.ts`
- **Registry**: `src/registry/NodeRegistry.ts`, `src/registry/registerBuiltins.ts`
- **Built-in specs**: `src/registry/builtins/*.spec.ts`
- **Node components**: `src/features/nodes/*.tsx`
- **Property grid introspection**: `src/features/property-grid/introspect.ts`
- **Connection validation**: `src/domain/validation/connectionRules.ts`
- [Zod documentation](https://zod.dev/) — for property schema authoring
- [Lucide icons](https://lucide.dev/icons/) — for node icon selection
- [xyflow / React Flow](https://reactflow.dev/) — the underlying graph library
