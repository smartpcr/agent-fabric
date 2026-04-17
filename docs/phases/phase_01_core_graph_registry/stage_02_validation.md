# Phase 1 — Stage 2: Validation

> Connection rules, graph invariants, typed error hierarchy, and property-based fuzz tests.
> Status: `[ ]` not started · **Effort**: 16h

## Steps

- [x] **Step 1**: DataType assignability table
  - File(s): `src/domain/validation/dataTypes.ts`, `tests/unit/domain/validation/dataTypes.test.ts`
  - Contents: `isAssignable(sourceType, targetType, whitelist?): boolean`; rules: `'any'` accepts all; `'any'` source assigns to all targets; else equality; optional whitelist map `{ 'json': ['string', 'number', ...] }` for controlled coercion.
  - Test: 100% — `any`↔anything; equality; whitelist; strict mismatch rejected.
  - Effort: 2h

- [ ] **Step 2**: `validateConnection(graph, src, tgt, registry)`
  - File(s): `src/domain/validation/connectionRules.ts`, `tests/unit/domain/validation/connectionRules.test.ts`
  - Contents: Returns `Result<void, ConnectionInvalidError>`; rules: direction (output→input), existence of ports on both nodes, dataType assignability, cardinality (`single` target must have no existing inbound edge on that port), no self-loop on same port, loop-back edges only from `canHaveBackEdge` nodes.
  - Test: 100% — 12 scenarios mapped to each rule; each failure returns a specific error `code`.
  - Effort: 4h

- [ ] **Step 3**: `validateGraph(graph, registry)` — full-graph rules
  - File(s): `src/domain/validation/graphRules.ts`, `tests/unit/domain/validation/graphRules.test.ts`
  - Contents: Returns `Result<void, GraphValidationError[]>`; rules: exactly one entry; terminal reachability; no unreachable nodes (DFS from entry); every required input port has an inbound edge; every loop node has exactly one loop-back edge.
  - Test: 100% — each rule fails with descriptive message; complex valid graph passes.
  - Effort: 4h

- [ ] **Step 4**: `validateNodeData(node, spec)` — Zod wrapper
  - File(s): `src/domain/validation/validators.ts`, `tests/unit/domain/validation/validators.test.ts`
  - Contents: Runs `spec.propertySchema.safeParse(node.data)`; converts zod error to our `ValidationError[]` shape (flat list with path + message).
  - Test: 100% — valid passes; multiple errors aggregate; deeply nested paths formatted as `a.b[0].c`.
  - Effort: 2h

- [ ] **Step 5**: Typed error hierarchy
  - File(s): `src/domain/validation/errors.ts`, `tests/unit/domain/validation/errors.test.ts`
  - Contents: `class DomainError extends Error`; subclasses `ConnectionInvalidError`, `GraphValidationError`, `SerializationError`, `MigrationError`; each carries a `code: string` and `details` object; JSON serializable (custom `toJSON`).
  - Test: 100% — `instanceof` chains; JSON round-trip preserves code + details; message formatting.
  - Effort: 2h

- [ ] **Step 6**: Property-based fuzz tests with `fast-check`
  - File(s): `tests/unit/domain/validation/graphRules.fuzz.test.ts`
  - Contents: `fc.assert(fc.property(arbitraryGraph(30), g => { if valid, adding any valid edge keeps it valid }))`; bounded by `maxNodes=30`, `numRuns=100`; time-boxed via test timeout.
  - Test: Runs < 2s in CI; zero regressions.
  - Effort: 2h

## Acceptance for Stage 2

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/domain/validation/**`.
- Error hierarchy usable across adapters without import cycles.
