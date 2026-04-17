# Phase 0 — Stage 2: App Shell & Providers

> Render an empty xyflow canvas inside a 3-pane editor layout; wire dependency-injection providers; add the zustand store skeleton and an error boundary.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: Add `@xyflow/react` and render an empty canvas
  - File(s): `src/features/editor/EditorPage.tsx`, `src/features/canvas/Canvas.tsx`, `src/features/canvas/Background.tsx`, `src/App.tsx`, `package.json`
  - Contents: Install `@xyflow/react`; `Canvas` renders `<ReactFlow>` with `<Background variant="dots" gap={16}/>` and `<Controls/>`; `Canvas` mounts with `role="application"` and an accessible name "Workflow Canvas".
  - Test: Component test renders `Canvas`; asserts `getByRole('application', { name: /workflow canvas/i })` is present.
  - Effort: 3h

- [x] **Step 2**: 3-pane editor layout (palette / canvas / property-grid)
  - File(s): `src/features/editor/EditorLayout.tsx`, `src/features/palette/Palette.tsx` (placeholder), `src/features/property-grid/PropertyGrid.tsx` (placeholder)
  - Contents: CSS grid layout `grid-template-columns: 240px 1fr 320px`; resizable splitters (use `react-resizable-panels`); collapsible side panels via `Ctrl+\` keyboard shortcut; panels have `role="complementary"` + `aria-label`.
  - Test: Component test asserts three panels exist; pressing `Ctrl+\` collapses/expands the palette; focus ring visible on splitter handle.
  - Effort: 3h

- [x] **Step 3**: Port interfaces & DI providers
  - File(s): `src/ports/IWorkflowRepository.ts`, `src/ports/IExecutionEventSource.ts`, `src/ports/IExecutionCommandSink.ts`, `src/ports/ITelemetrySink.ts`, `src/providers/RepositoryProvider.tsx`, `src/providers/ExecutionProvider.tsx`, `src/providers/TelemetryProvider.tsx`, `src/providers/WorkflowProviders.tsx`, `src/hooks/useWorkflowRepo.ts`, `src/hooks/useExecutionEventSource.ts`, `src/hooks/useTelemetry.ts`, `src/adapters/NoopTelemetrySink.ts`
  - Contents: Each provider exposes a context; each hook throws `"<X> used outside of provider"` if context is null. `NoopTelemetrySink` is registered by default so tests don't need to wire telemetry.
  - Test: Unit: `useWorkflowRepo()` throws outside provider; returns injected impl inside; `NoopTelemetrySink.track()` is a no-op (can be spied but does nothing).
  - Effort: 4h

- [x] **Step 4**: Zustand store skeleton + `createStore` factory
  - File(s): `src/store/createStore.ts`, `src/store/hooks.ts`, `src/store/slices/graphSlice.ts`, `src/store/slices/selectionSlice.ts`, `src/store/slices/registrySlice.ts`, `src/store/slices/executionSlice.ts`, `src/store/slices/viewportSlice.ts`
  - Contents: Each slice exports `createXxxSlice(set, get)` returning state + actions (stubs for now — just initial state). `createStore()` composes slices via spread; `useWorkflowStore` exported as typed hook.
  - Test: Unit: `createStore()` returns an object containing keys from all five slices; initial state matches an inline snapshot; the store survives a round-trip via `JSON.parse(JSON.stringify(store.getState()))` when `executionSlice` is excluded.
  - Effort: 2h

- [ ] **Step 5**: App-wide error boundary + toast system
  - File(s): `src/providers/ErrorBoundary.tsx`, `src/features/editor/Toast.tsx`, `src/hooks/useToast.ts`
  - Contents: Class-component error boundary renders `FallbackUi` with a recovery button; toast queue via Radix `Toast.Provider`; `useToast().show({ title, description, variant })` pushes into queue; auto-dismiss after 4s.
  - Test: Unit: rendering a child that throws shows fallback; clicking recover re-mounts children. `useToast` test asserts a shown toast is visible and dismisses after fake-timer advance.
  - Effort: 2h

## Acceptance for Stage 2

- `EditorPage` renders the three-panel layout with a working canvas and collapsible panels.
- All four DI providers throw with a helpful message when unused.
- Store skeleton instantiable in tests without React.
- 100% coverage on new files.
