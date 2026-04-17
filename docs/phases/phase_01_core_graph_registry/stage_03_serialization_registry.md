# Phase 1 — Stage 3: Serialization & Registry
> Versioned JSON schema, (de)serialization, migration registry stub, NodeRegistry with Start/End/Task built-ins.
> Status: `[ ]` not started · **Effort**: 20h

## Steps

- [ ] **Step 1**: JSON schema v1 definition
  - File(s): `src/domain/serialization/schema.v1.ts`, `tests/unit/domain/serialization/schema.v1.test.ts`
  - Contents: `GraphJsonV1` as a Zod schema mirroring `WorkflowGraph`; nodes/edges are discriminated on `kind`; `schemaVersion: z.literal(1)`.
  - Test: 100% — Zod accepts a valid payload; rejects missing fields; rejects wrong `schemaVersion`.
  - Effort: 3h

- [ ] **Step 2**: `serialize(graph): GraphJson`
  - File(s): `src/domain/serialization/serialize.ts`, `tests/unit/domain/serialization/serialize.test.ts`
  - Contents: Deterministic key order (alphabetical); runs `validateGraph` first; throws `SerializationError` on invalid input.
  - Test: 100% — stable output byte-for-byte across runs; rejects invalid graph; preserves all fields.
  - Effort: 2h

- [ ] **Step 3**: `deserialize(json, registry): Graph`
  - File(s): `src/domain/serialization/deserialize.ts`, `tests/unit/domain/serialization/deserialize.test.ts`
  - Contents: Parses via Zod → constructs `WorkflowGraph`; unknown `kind` throws `SerializationError` (`kind not registered`); schema-version mismatch delegates to `migrate()`.
  - Test: 100% — round-trip equality with `serialize`; unknown kind error; version mismatch triggers migration.
  - Effort: 3h

- [ ] **Step 4**: `migrate(json): GraphJson` registry stub (no-op v1 → v1)
  - File(s): `src/domain/serialization/migrate.ts`, `tests/unit/domain/serialization/migrate.test.ts`
  - Contents: `const migrations = new Map<number, (json) => json>()`; `migrate(json)` repeatedly applies until `schemaVersion === CURRENT`; errors on unknown source version.
  - Test: 100% — identity for v1; throws on unknown version; registry shape ready for Phase 7 to add entries.
  - Effort: 2h

- [ ] **Step 5**: `NodeRegistry` class
  - File(s): `src/registry/NodeRegistry.ts`, `tests/unit/registry/NodeRegistry.test.ts`
  - Contents: `register(spec)`, `resolve(kind)`, `list()`, `freeze()`; duplicate `kind` throws; `freeze()` prevents further registration; `resolve` throws `UnknownNodeKindError` if not registered.
  - Test: 100% — register/resolve/list; duplicate error; frozen registry rejects register with clear error.
  - Effort: 3h

- [ ] **Step 6**: Built-in `StartNode` spec
  - File(s): `src/registry/builtins/StartNode.spec.ts`, `tests/unit/registry/builtins/StartNode.test.ts`
  - Contents: kind `'start'`, 1 output port `out`, `capabilities.isEntry = true`, `propertySchema = z.object({})`, `defaultData = {}`.
  - Test: 100% — spec shape; registers cleanly; capabilities.
  - Effort: 2h

- [ ] **Step 7**: Built-in `EndNode` spec
  - File(s): `src/registry/builtins/EndNode.spec.ts`, `tests/unit/registry/builtins/EndNode.test.ts`
  - Contents: kind `'end'`, 1 input port `in`, `capabilities.isTerminal = true`.
  - Test: 100%.
  - Effort: 1h

- [ ] **Step 8**: Built-in `TaskNode` spec
  - File(s): `src/registry/builtins/TaskNode.spec.ts`, `tests/unit/registry/builtins/TaskNode.test.ts`
  - Contents: kind `'task'`, 1 input / 1 output; `propertySchema = z.object({ name: z.string().min(1), params: z.record(z.unknown()).default({}) })`; `defaultData = { name: 'Task', params: {} }`.
  - Test: 100% — schema accepts/rejects; default conforms.
  - Effort: 2h

- [ ] **Step 9**: `registerBuiltins(registry)` helper
  - File(s): `src/registry/registerBuiltins.ts`, `tests/unit/registry/registerBuiltins.test.ts`
  - Contents: Idempotent: a second call is a no-op; registers Start / End / Task.
  - Test: 100% — 3 kinds present; second call doesn't throw.
  - Effort: 1h

- [ ] **Step 10**: Integration test — end-to-end round trip
  - File(s): `tests/integration/domain.round-trip.test.ts`
  - Contents: Build a 3-node graph via model API → serialize → deserialize → assert deep-equal and `validateGraph` returns ok.
  - Test: Passes in CI.
  - Effort: 1h

## Acceptance for Stage 3
- All 10 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/domain/serialization/**` and `src/registry/**`.
- Integration round-trip test green.
