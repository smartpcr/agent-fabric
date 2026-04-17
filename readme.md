# Agent Fabric — Workflow Designer

A visual **workflow designer** built with React, TypeScript, and [`@xyflow/react`](https://reactflow.dev/) that lets users compose, configure, and monitor AI agent workflows through a drag-and-drop canvas.

## Architecture

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

## Getting Started

### Prerequisites

- **Node.js** 22.x (see `.nvmrc`)
- **npm** 10+

### Setup

```bash
git clone https://github.com/smartpcr/agent-fabric.git
cd agent-fabric
npm install
```

### Development Loop

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run lint         # ESLint — strict TypeScript rules
npm run typecheck    # tsc --noEmit
npm run test         # Vitest unit tests
npm run test:coverage # Unit tests with 100% coverage enforcement
npm run e2e          # Playwright end-to-end tests (build first)
npm run build        # Production build (tsc + vite build)
```

### Quick Smoke Check

```bash
npm run dev          # verify the editor renders an empty canvas
npm run test         # all unit tests green
npm run build && npm run e2e  # e2e smoke passes on Chromium
npm run lint && npm run typecheck  # zero errors
```

## Project Structure

```
src/
├── features/        # Feature modules (editor, canvas, palette, property-grid)
├── store/           # Zustand store with slices (graph, selection, registry, execution, viewport)
├── providers/       # React context providers (DI, error boundary)
├── hooks/           # Custom hooks (useWorkflowRepo, useToast, etc.)
├── ports/           # DI port interfaces
├── adapters/        # Adapter implementations (NoopTelemetrySink, etc.)
└── styles/          # Tailwind CSS + design tokens
tests/
├── unit/            # Vitest unit & component tests
├── e2e/             # Playwright end-to-end tests
└── setup.ts         # Test environment setup
```

## Documentation

- [Workflow UI Implementation Plan](docs/workflow-ui-plan.md) — full design document
- [Phase 0 — Foundation](docs/phases/phase_00_foundation.md) — project scaffolding
- [Phase 1 — Core Graph & Registry](docs/phases/phase_01_core_graph_registry.md)
- [Phase 2 — Canvas & Drag-Drop](docs/phases/phase_02_canvas_drag_drop.md)
- [Phase 3 — Ports & Edges](docs/phases/phase_03_ports_edges.md)
- [Phase 4 — Control Flow](docs/phases/phase_04_control_flow.md)
- [Phase 5 — Property Grid](docs/phases/phase_05_property_grid.md)
- [Phase 6 — Execution Visualization](docs/phases/phase_06_execution_visualization.md)
- [Phase 7 — Persistence & Undo](docs/phases/phase_07_persistence_undo.md)
- [Phase 8 — Polish & Release](docs/phases/phase_08_polish_release.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for commit conventions, branch naming, and the PR checklist.

## License

Private — internal use only.
