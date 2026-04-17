# Phase 1 — Stage 1: Domain Models

> Pure TypeScript models for ports, nodes, edges, graphs, node specs, and execution state — framework-free, 100% unit tested.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: `PortSpec`, `PortKind`, `PortCardinality` types + factory helpers
  - File(s): `src/domain/models/port.ts`, `tests/unit/domain/models/port.test.ts`
  - Contents: Export `type PortKind = 'in' | 'out'`, `type PortCardinality = 'single' | 'multi'`, `interface PortSpec { id; kind; label; dataType; cardinality; required? }`; factories `makeInputPort({...})`, `makeOutputPort({...})` with sensible defaults (`cardinality = 'single'`, `dataType = 'any'`).
  - Test: 100% — non-empty id/label required (throws); defaults applied; frozen object.
  - Effort: 2h

- [x] **Step 2**: `WorkflowNode<TData>` + id generator
  - File(s): `src/domain/models/node.ts`, `src/utils/id.ts`, `tests/unit/domain/models/node.test.ts`, `tests/unit/utils/id.test.ts`
  - Contents: `newId(prefix)` using `nanoid`; `interface WorkflowNode<TData = unknown> { id; kind; position; data }`; factory `makeNode({kind, data, position?})` generates id and default position `{x:0,y:0}`.
  - Test: 100% — IDs unique across 10k calls; position validated as finite numbers; generic `data` type preserved.
  - Effort: 2h

- [x] **Step 3**: `WorkflowEdge` model
  - File(s): `src/domain/models/edge.ts`, `tests/unit/domain/models/edge.test.ts`
  - Contents: `interface WorkflowEdge { id; source; sourcePort; target; targetPort; label?; condition?; kind }`; `kind: 'default' | 'loop-back'`; factory `makeEdge({...})`.
  - Test: 100% — id unique; source/target required; kind defaults to `'default'`.
  - Effort: 2h

- [x] **Step 4**: `WorkflowGraph` aggregate + pure operations
  - File(s): `src/domain/models/graph.ts`, `tests/unit/domain/models/graph.test.ts`
  - Contents: `interface WorkflowGraph { schemaVersion; id; name; nodes; edges }`; `CURRENT_SCHEMA_VERSION = 1`; pure ops `addNodeToGraph(g, n)`, `removeNodeFromGraph(g, id)` (also removes incident edges), `addEdgeToGraph(g, e)`, `removeEdgeFromGraph(g, id)`. All return new graph (no mutation).
  - Test: 100% — empty graph; add/remove; removing node cascades edges; immutability verified by structural equality + reference inequality.
  - Effort: 3h

- [ ] **Step 5**: `NodeSpec<TData>` + ZodSchema binding
  - File(s): `src/domain/models/nodeSpec.ts`, `tests/unit/domain/models/nodeSpec.test.ts`
  - Contents: `interface NodeSpec<TData> { kind; category; label; icon; ports; propertySchema: z.ZodType<TData>; defaultData: TData; capabilities }`; helper `validateSpec(spec)` ensures port ids unique within the spec; `defaultData` conforms to `propertySchema`.
  - Test: 100% — valid spec accepted; duplicate port id rejected; `defaultData` not conforming to schema rejected.
  - Effort: 3h

- [ ] **Step 6**: `NodeExecutionState` and `EdgeExecutionState` discriminated unions
  - File(s): `src/domain/models/executionState.ts`, `src/utils/assertNever.ts`, `tests/unit/domain/models/executionState.test.ts`
  - Contents: `type NodeExecutionState = {status:'pending'} | {status:'running'; startedAt; iteration?} | {status:'success'; finishedAt; result?} | {status:'error'; finishedAt; error} | {status:'skipped'}`; similar for `EdgeExecutionState`; `assertNever(x): never` for exhaustive matching.
  - Test: 100% — construction of each variant; `assertNever` throws on unexpected.
  - Effort: 2h

## Acceptance for Stage 1

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/domain/models/**`.
- Domain modules import nothing from `react`, `@xyflow/react`, or `zustand`.
