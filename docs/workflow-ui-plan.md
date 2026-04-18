# Workflow UI — Implementation Plan

> Generated: 2026-04-17
> Target: `agent-fabric` repo — visual workflow designer with runtime execution visualization
> Library: `@xyflow/react` v12 (formerly `reactflow`)
> Format convention: `[ ]` not started · `[~]` in progress · `[x]` completed (score ≥ 90/100)

---

## Table of Contents

**Design (this document)**

1. [Executive Summary](#1-executive-summary)
2. [Functional Requirements](#2-functional-requirements)
3. [Technology Stack](#3-technology-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [Domain Model](#5-domain-model)
6. [Module / Folder Layout](#6-module--folder-layout)
7. [Patterns & Best Practices](#7-patterns--best-practices)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [Testing Strategy](#9-testing-strategy)
10. [Risk Analysis](#10-risk-analysis)

**Phase Documents (detailed step-by-step specs with checkboxes & test coverage)**

| Phase     | Document                                                                                                                                      | Description                                 | Stages |   Steps | Effort (h) | Status     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -----: | ------: | ---------: | ---------- |
| 0         | [phases/phase_00_foundation/](phases/phase_00_foundation/) — [overview](phases/phase_00_foundation.md)                                        | Vite/React/TS scaffolding, DI providers, CI |      3 |      17 |         40 | `[ ]` 0%   |
| 1         | [phases/phase_01_core_graph_registry/](phases/phase_01_core_graph_registry/) — [overview](phases/phase_01_core_graph_registry.md)             | Domain models, validation, registry, store  |      4 |      30 |         70 | `[ ]` 0%   |
| 2         | [phases/phase_02_canvas_drag_drop/](phases/phase_02_canvas_drag_drop/) — [overview](phases/phase_02_canvas_drag_drop.md)                      | Canvas, palette, drag-drop, selection       |      6 |      34 |         80 | `[x]` 100% |
| 3         | [phases/phase_03_ports_edges/](phases/phase_03_ports_edges/) — [overview](phases/phase_03_ports_edges.md)                                     | Ports, edges, connection validation         |      5 |      23 |         60 | `[~]` 90%  |
| 4         | [phases/phase_04_control_flow/](phases/phase_04_control_flow/) — [overview](phases/phase_04_control_flow.md)                                  | Decision nodes, loops, ELK layout           |      3 |      23 |         80 | `[ ]` 0%   |
| 5         | [phases/phase_05_property_grid/](phases/phase_05_property_grid/) — [overview](phases/phase_05_property_grid.md)                               | Schema-driven property grid                 |      4 |      25 |         70 | `[ ]` 0%   |
| 6         | [phases/phase_06_execution_visualization/](phases/phase_06_execution_visualization/) — [overview](phases/phase_06_execution_visualization.md) | Live badges, edge animation, inspector      |      6 |      32 |         80 | `[ ]` 0%   |
| 7         | [phases/phase_07_persistence_undo/](phases/phase_07_persistence_undo/) — [overview](phases/phase_07_persistence_undo.md)                      | Persistence, versioning, undo/redo          |      5 |      20 |         50 | `[ ]` 0%   |
| 8         | [phases/phase_08_polish_release/](phases/phase_08_polish_release/) — [overview](phases/phase_08_polish_release.md)                            | A11y, theming, i18n, perf, release          |      4 |      17 |         50 | `[ ]` 0%   |
| **Total** |                                                                                                                                               |                                             | **40** | **216** |    **580** | **0%**     |

**Appendices (this document)**

- [Appendix A — Effort Rollup](#appendix-a--effort-rollup)
- [Appendix B — Node Type Inventory](#appendix-b--node-type-inventory)
- [Appendix C — Glossary](#appendix-c--glossary)

---

## 1. Executive Summary

### What We're Building

An interactive **workflow designer** embedded in the `agent-fabric` frontend that lets users:

- Author workflows visually by dragging **components** (nodes) from a palette onto a canvas
- Connect components via **typed ports** (one component may expose N input / M output ports)
- Compose **decision trees** (conditional branches) and **loops** (back-edges with exit conditions)
- Edit component configuration via a **schema-driven property grid**
- Watch the workflow **execute live**, with badges on nodes and animated edges reflecting runtime state (pending → running → success/error)
- Save / load / version workflows as portable JSON

### Why xyflow / React Flow v12

| Capability                              | Evidence it's sound                                                  |
| --------------------------------------- | -------------------------------------------------------------------- |
| Mature, MIT-licensed, ~25k GitHub stars | Used in production by n8n, LangGraph Studio, Zapier, Supabase Studio |
| First-class TypeScript                  | Types are authoritative, not retrofitted                             |
| Built on Zustand internally             | Store is inspectable; no hidden magic                                |
| Customizable nodes / edges / handles    | Full render ownership — we bring our own components                  |
| Virtualized rendering                   | Scales to ~1,000 nodes before needing extra work                     |
| Active maintenance                      | v12 released 2024-09; weekly releases                                |

### Scope & Scale Estimate

| Metric                    | Estimate                            |
| ------------------------- | ----------------------------------- |
| Source files (`src/`)     | ~180–240                            |
| Test files                | ~140–180 (unit + integration + e2e) |
| Unit test coverage target | **100% of new code**                |
| LOC (excl. tests)         | ~12,000–16,000                      |
| NPM deps (runtime)        | ~18–22                              |
| Total effort (this plan)  | **~580 hours** across 9 phases      |
| Calendar time (2 eng)     | ~14–16 weeks                        |

---

## 2. Functional Requirements

**R1. Canvas** — Infinite pan/zoom canvas; mini-map; fit-to-view; grid background; snap-to-grid (toggleable).

**R2. Palette & Drag-Drop** — Sidebar palette grouped by category; drag node type onto canvas; drop creates a node at pointer. Keyboard-accessible.

**R3. Components (Nodes)** — Each component type has a declarative spec: id, label, icon, category, ports, property schema, default data. Built-in types: `Start`, `End`, `Task`, `Decision`, `Loop`, `Parallel`, `SubWorkflow`.

**R4. Connections (Edges)** — Drag from output port to input port; validator rejects type-incompatible or cardinality-violating connections. Edges support labels, conditions, runtime animations.

**R5. Decision Tree** — Decision node: one input, ≥2 labeled output ports. Each outgoing edge carries a condition expression.

**R6. Loops** — Loop node: `body-in` / `body-out` / `break` ports; exactly one loop-back edge. Dashed/curved visual.

**R7. Property Grid** — Right-hand panel driven by Zod/JSON-Schema. Supports 8 field types, debounced commit, inline validation.

**R8. Execution Visualization** — Live event stream drives node badges (`pending`, `running`, `success`, `error`, `skipped`) + edge animations. Inspector for payloads.

**R9. Persistence** — Versioned JSON serialization; `IWorkflowRepository` port for save/load; import/export; undo/redo ≥50 steps.

**R10. Accessibility** — Full keyboard path; ARIA-live announcements; WCAG AA.

---

## 3. Technology Stack

### Runtime

| Concern       | Choice                                         | Rationale                                   |
| ------------- | ---------------------------------------------- | ------------------------------------------- |
| Language      | TypeScript 5.5+                                | Strict mode; exhaustive checks              |
| Framework     | React 18                                       | Concurrent features, `useSyncExternalStore` |
| Build         | Vite 5                                         | Fast HMR; first-class TS                    |
| Graph library | `@xyflow/react` v12                            | Production-proven (n8n, LangGraph Studio)   |
| State         | `zustand` v4 + `immer`                         | Same store xyflow uses internally           |
| Undo/redo     | `zundo` (temporal middleware)                  | 1.5k⭐ battle-tested                        |
| Schema        | `zod` v3                                       | Runtime + compile-time types                |
| Forms         | `react-hook-form` + `zod` resolver             | Decoupled from UI kit                       |
| UI primitives | `@radix-ui/react-*`                            | Unstyled, a11y-verified                     |
| Styling       | Tailwind CSS 3 + CSS variables                 | Utility-first                               |
| Icons         | `lucide-react`                                 | Tree-shakable                               |
| Auto-layout   | `elkjs` (WASM)                                 | Handles loops, hierarchical graphs          |
| Live events   | `eventsource-parser`, `reconnecting-websocket` | Abstract behind port                        |
| Equality      | `fast-equals`                                  | Selector memoization                        |

### Dev / Test

| Concern           | Choice                                                         |
| ----------------- | -------------------------------------------------------------- |
| Unit              | **Vitest** + `@vitest/coverage-v8` (100% thresholds on `src/`) |
| Component         | `@testing-library/react` + `user-event`                        |
| DOM               | `jsdom` (default), `happy-dom` for hot paths                   |
| E2E               | **Playwright** (Chromium + Firefox + WebKit)                   |
| Mocks             | `msw` v2 for HTTP & WS contract mocking                        |
| Visual regression | Playwright screenshot diffing                                  |
| Lint / format     | `eslint-config-typescript-strict` + `prettier`                 |
| Commit gates      | `husky` + `lint-staged`                                        |

Every library ships TS types, has >500k weekly npm downloads, or is a first-party Eclipse / W3C / Radix project.

---

## 4. Architecture Overview

### Layered View

```
┌───────────────────────────────────────────────────────────────────┐
│                      App Shell (routes, layout)                    │
├───────────────────────────────────────────────────────────────────┤
│   Workflow Editor (Canvas + Palette + PropertyGrid + Toolbar)      │
│   React components, Radix primitives, Tailwind styles              │
├───────────────────────────────────────────────────────────────────┤
│   Feature Stores (Zustand slices)                                  │
│   graphStore · registryStore · executionStore · historyStore       │
├───────────────────────────────────────────────────────────────────┤
│   Domain (pure TS, framework-free)                                 │
│   models/ · validation/ · serialization/ · layout/                 │
├───────────────────────────────────────────────────────────────────┤
│   Ports (DI interfaces)                                            │
│   IWorkflowRepository · IExecutionEventSource · IExecutionCommand  │
│   Sink · ITelemetrySink                                            │
├───────────────────────────────────────────────────────────────────┤
│   Adapters (swappable in tests)                                    │
│   HttpWorkflowRepository · Sse/WsExecutionEventSource · NoopSinks  │
└───────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision                                  | Rationale                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Domain-first; UI is a thin projection** | `models/`, `validation/` are framework-free, 100% unit-tested without React                      |
| **Zustand slices**                        | One store, multiple slices (graph/selection/execution/registry). Avoids Context re-render storms |
| **Controlled xyflow**                     | We own `nodes`/`edges` arrays; commit changes through store actions so zundo records them        |
| **Node Type Registry**                    | Pluggable: third-party nodes register `{ kind, spec, component }` tuples                         |
| **Execution state out-of-band**           | Runtime state lives in `executionStore` keyed by `nodeId` — authoring graph stays clean          |
| **Ports are first-class**                 | `{ id, kind, dataType, cardinality, label }` not just a handle position                          |
| **Commands for undo**                     | Every mutation is a named store action; `zundo` snapshots linearly                               |
| **DI via Context at shell**               | App wires implementations; features consume via hooks; tests inject fakes                        |
| **Feature flags via env**                 | `VITE_FEATURE_LOOPS=1` for incremental rollout                                                   |

### Data Flow (User drags a node)

```
User drops Node ─► <Canvas onDrop>
                    ├─► registryStore resolves NodeSpec
                    ├─► viewport-relative position
                    └─► graphStore.addNode({spec, position})
                         ├─► zundo records command
                         ├─► immer state update
                         └─► <ReactFlow> re-renders
```

### Data Flow (Live execution badge)

```
Backend event ─► IExecutionEventSource.subscribe
                 └─► executionStore.applyEvent({nodeId, state, payload})
                      └─► <CustomNode> via useExecutionState(nodeId)
                           └─► renders <StatusBadge/> + pulses edge
```

---

## 5. Domain Model

All types live in `src/domain/models/` as discriminated unions. Excerpt:

```ts
export interface PortSpec {
  id: string; // unique within node
  kind: "in" | "out";
  label: string;
  dataType: string; // 'any' | 'json' | 'string' | ...
  cardinality: "single" | "multi";
  required?: boolean;
}

export interface NodeSpec<TData = unknown> {
  kind: string; // 'task' | 'decision' | ...
  category: string;
  label: string;
  icon: string;
  ports: PortSpec[];
  propertySchema: ZodSchema<TData>;
  defaultData: TData;
  capabilities: {
    canHaveBackEdge?: boolean;
    isTerminal?: boolean;
    isEntry?: boolean;
  };
}

export interface WorkflowNode<TData = unknown> {
  id: string;
  kind: string;
  position: { x: number; y: number };
  data: TData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
  label?: string;
  condition?: string;
  kind: "default" | "loop-back";
}

export interface WorkflowGraph {
  schemaVersion: number;
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type NodeExecutionState =
  | { status: "pending" }
  | { status: "running"; startedAt: number; iteration?: number }
  | { status: "success"; finishedAt: number; result?: unknown }
  | { status: "error"; finishedAt: number; error: string }
  | { status: "skipped" };
```

### Connection Rules (enforced by `validateConnection`)

1. Source is output; target is input.
2. `dataType` is assignable (`any` accepts all; else equality or whitelist).
3. Target cardinality `single` ⇒ no existing inbound; `multi` ⇒ unlimited.
4. No self-loops on the same port.
5. Loop-back edges only from nodes with `capabilities.canHaveBackEdge`.
6. Decision outputs: each edge matches a declared branch or `default`.

### Graph Validation (runs on save / on demand)

- Exactly one `isEntry` node.
- All terminal paths end at `isTerminal` nodes.
- No unreachable nodes (DFS from entry).
- Every required input port has an inbound edge.
- Every loop node has exactly one loop-back edge.

---

## 6. Module / Folder Layout

```
agent-fabric/
├── package.json · vite.config.ts · tsconfig.json · playwright.config.ts
├── src/
│   ├── main.tsx · App.tsx
│   ├── providers/            # WorkflowProviders, RepositoryProvider, ExecutionProvider
│   ├── domain/               # framework-free
│   │   ├── models/           # port, node, edge, graph, nodeSpec, executionState
│   │   ├── validation/       # connectionRules, graphRules, validators, errors
│   │   ├── serialization/    # schema.v1, serialize, deserialize, migrate
│   │   └── layout/           # elkAdapter, routing
│   ├── store/
│   │   ├── createStore.ts    # zustand + zundo + immer
│   │   ├── slices/           # graph, selection, viewport, registry, execution
│   │   ├── selectors/
│   │   └── hooks.ts
│   ├── registry/
│   │   ├── NodeRegistry.ts
│   │   ├── builtins/         # Start, End, Task, Decision, Loop, Parallel, SubWorkflow
│   │   └── registerBuiltins.ts
│   ├── ports/                # DI interfaces
│   ├── adapters/             # Http, Sse, Ws, InMemory, Noop
│   ├── features/
│   │   ├── editor/           # EditorPage, EditorLayout, Toolbar
│   │   ├── canvas/           # Canvas, nodeTypes, edgeTypes, Background, MiniMap, Controls
│   │   ├── palette/          # Palette, PaletteItem, useDragStart
│   │   ├── nodes/            # BaseNode, TaskNode, DecisionNode, LoopNode, badges, ports
│   │   ├── edges/            # DefaultEdge, LoopBackEdge, ConditionalEdge
│   │   ├── property-grid/    # PropertyGrid, SchemaForm, fields/
│   │   ├── execution/        # useExecutionSubscription, ExecutionOverlay, RunInspector
│   │   ├── persistence/      # SaveLoadBar, ImportExport, useAutoSave
│   │   └── history/          # UndoRedoButtons, useHistoryShortcut
│   ├── hooks/ · utils/ · styles/ · types/
├── tests/
│   ├── unit/                 # mirrors src/
│   ├── integration/
│   └── e2e/
└── docs/
    ├── workflow-ui-plan.md   # this file
    └── phases/               # per-phase specs
```

---

## 7. Patterns & Best Practices

### 7.1 Store Pattern

```ts
export const useWorkflowStore = create<WorkflowState>()(
  temporal(
    immer((set, get) => ({
      ...createGraphSlice(set, get),
      ...createSelectionSlice(set, get),
      ...createRegistrySlice(set, get),
      ...createExecutionSlice(set, get),
    })),
    { limit: 50, partialize: (s) => pick(s, ["nodes", "edges"]) },
  ),
);
```

### 7.2 Controlled xyflow

```tsx
<ReactFlow
  nodes={useStore((s) => s.nodes)}
  edges={useStore((s) => s.edges)}
  onNodesChange={(c) => store.applyNodeChanges(c)}
  onEdgesChange={(c) => store.applyEdgeChanges(c)}
  onConnect={(c) => store.tryConnect(c)}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  isValidConnection={(conn) => validateConnection(store.getState(), conn)}
/>
```

### 7.3 Dependency Injection

Providers at app root inject implementations; tests substitute `InMemoryWorkflowRepository`, `FakeExecutionEventSource` (exposes `emit()` for driving tests).

### 7.4 Error Handling

- Domain throws typed errors: `ConnectionInvalidError`, `GraphValidationError`, `SerializationError`.
- React Error Boundaries render fallback UI.
- Adapters return `Result<T, E>` (discriminated union) — never throw.

---

## 8. Cross-Cutting Concerns

### 8.1 Performance Budgets

| Metric                            | Target                         |
| --------------------------------- | ------------------------------ |
| First meaningful paint (cached)   | < 1500 ms                      |
| Interaction to next paint on drag | < 50 ms p95                    |
| 500-node canvas pan               | 60 fps                         |
| Execution event handling          | < 16 ms per event at 20 ev/sec |

Mitigations: `fast-equals` memoization; `useSyncExternalStore`; virtualized palette; CSS containment; RAF coalescing for events.

### 8.2 Accessibility (WCAG 2.1 AA)

- Full keyboard path for palette → canvas → property grid.
- Visible focus ring on all interactive elements.
- `aria-live="polite"` region for selection/connection/run state.
- Color never the sole status carrier (icons + text on badges).

### 8.3 Internationalization

All user-visible strings route through `t(key)` via `react-i18next`. ESLint rule prevents hard-coded JSX strings. Locale switch ships in Phase 8.

### 8.4 Telemetry

`ITelemetrySink.track(event, payload)` at node added, edge connected, property saved, workflow saved, run started. No PII.

### 8.5 Security

- Monaco workers run read-only in property grid CodeField.
- Imported JSON validated by Zod before touching the store.
- Adapter HTTP calls include CSRF token.

---

## 9. Testing Strategy

**Every step below must ship with 100% unit-test coverage on its new/changed source files.**

- `vitest.config.ts` sets `coverage.thresholds.100 = true` with `coverage.include = ['src/**/*.{ts,tsx}']`.
- CI fails on any coverage drop.
- Integration tests are additive; they do not count toward the 100% threshold.
- E2E runs on every PR (Chromium); full matrix nightly.

**Scoring rubric (per step)**

| Axis                                         |  Weight |
| -------------------------------------------- | ------: |
| Functional correctness                       |      40 |
| Unit test coverage (100% = 25, linear below) |      25 |
| Accessibility checks passing                 |      10 |
| Lint / typecheck clean                       |      10 |
| Integration/E2E where mandated               |      10 |
| Docs / non-obvious code comments             |       5 |
| **Total**                                    | **100** |

A step is `[x]` only when score ≥ 90.

---

## 10. Risk Analysis

### High

| Risk                                      | Impact          | Mitigation                                                       |
| ----------------------------------------- | --------------- | ---------------------------------------------------------------- |
| xyflow internal API shifts between minors | Breaking canvas | Pin minor; wrap every xyflow import behind our own module        |
| Loops + orthogonal routing look jumbled   | UX regression   | Invest in ELK early (Phase 4 Stage 3); fall back to manual bends |
| Animation frame cost at high event rates  | Dropped frames  | RAF-coalesce events; CSS-based edge animations                   |
| 100% coverage inflates trivial tests      | Slower velocity | Exempt `*.d.ts`, `index.ts` re-exports via coverage `exclude`    |

### Medium

| Risk                                 | Impact                 | Mitigation                                                              |
| ------------------------------------ | ---------------------- | ----------------------------------------------------------------------- |
| Nested array/object property editing | Scope creep            | Scope field registry to 8 primitives in Phase 5; defer custom renderers |
| Schema migration drift               | Old workflows fail     | Versioned schema from day 1; migration tests per version bump           |
| Cross-browser drag-drop quirks       | Flaky drops on Firefox | Pointer events, not HTML5 DnD; xyflow agrees                            |

### Low

| Risk                             | Impact          | Mitigation                               |
| -------------------------------- | --------------- | ---------------------------------------- |
| Radix + Tailwind class collision | Visual bugs     | CSS layers; Tailwind `tw-` prefix option |
| Large bundle (Monaco)            | Slow first load | Code-split CodeField                     |

---

## Appendix A — Effort Rollup

| Phase                         | Stages |   Steps | Effort (h) | Status   |
| ----------------------------- | -----: | ------: | ---------: | -------- |
| 0 — Foundation                |      3 |      17 |         40 | `[ ]` 0% |
| 1 — Core Graph & Registry     |      4 |      30 |         70 | `[ ]` 0% |
| 2 — Canvas & Drag-Drop        |      6 |      29 |         80 | `[ ]` 0% |
| 3 — Ports, Edges & Validation |      5 |      23 |         60 | `[ ]` 0% |
| 4 — Control Flow Nodes        |      3 |      23 |         80 | `[ ]` 0% |
| 5 — Property Grid             |      4 |      25 |         70 | `[ ]` 0% |
| 6 — Execution Visualization   |      6 |      32 |         80 | `[ ]` 0% |
| 7 — Persistence & Undo        |      5 |      20 |         50 | `[ ]` 0% |
| 8 — Polish & Release          |      4 |      17 |         50 | `[ ]` 0% |
| **Total**                     | **40** | **216** |    **580** | **0%**   |

**Tracking rule**: a phase's **% complete** = Σ(completed step effort) / Σ(all step effort within the phase). A phase is `[x]` only when all stages are `[x]` AND every step scored ≥ 90.

---

## Appendix B — Node Type Inventory

| Kind                 | Phase introduced  | Ports                              | Capabilities      |
| -------------------- | ----------------- | ---------------------------------- | ----------------- |
| `start`              | 1                 | 1 out                              | `isEntry`         |
| `end`                | 1                 | 1 in                               | `isTerminal`      |
| `task`               | 1                 | 1 in, 1 out                        | —                 |
| `multi-port-task`    | 3 (fixture)       | N in, M out                        | —                 |
| `decision` (if/else) | 4                 | 1 in, 2 out (`true`, `false`)      | —                 |
| `decision` (switch)  | 4                 | 1 in, ≥2 out + `default`           | —                 |
| `loop` (while)       | 4                 | in, body-out, body-in, done        | `canHaveBackEdge` |
| `loop` (for-each)    | 4                 | in, body-out, body-in, done, break | `canHaveBackEdge` |
| `parallel`           | 4 (deferred)      | 1 in, N out, 1 join                | —                 |
| `sub-workflow`       | v2 (out of scope) | 1 in, 1 out                        | —                 |

---

## Appendix C — Glossary

- **Canvas** — infinite zoomable surface holding the graph.
- **Component / Node** — typed vertex; rendered as a React component.
- **Port** — typed attachment point; input or output; has data type and cardinality.
- **Connection / Edge** — directed link from an output port to an input port.
- **Property Grid** — right-hand form editing the selected node's `data`.
- **Decision Tree** — pattern where a `decision` node routes to different downstream subgraphs.
- **Loop** — pattern with a `loop` node and back-edge re-entering its `body-in` port.
- **Badge** — small visual state indicator (pending/running/success/error/skipped) on a node.
- **Run** — one execution of a workflow; has a unique `runId` and a stream of `ExecutionEvent`s.
- **Schema Version** — integer on persisted `WorkflowGraph` JSON; migrations upgrade older versions.

_End of plan. Maintain as the source of truth: check off steps as they land; update phase status rows above; add discoveries under the appropriate stage._
