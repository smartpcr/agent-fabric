# Phase 7 — Stage 2: Import / Export

> File download/upload of workflow JSON; drag-to-drop file onto canvas.
> Status: `[ ]` not started · **Effort**: 10h

## Steps

- [x] **Step 1**: Download JSON of current graph
  - File(s): `src/features/persistence/ImportExport.tsx`, `tests/unit/features/persistence/ImportExport.test.tsx`
  - Contents: Serialize current graph → `Blob` → download via temporary `<a>` link.
  - Test: 100% — click triggers blob with correct content; filename includes workflow name + timestamp.
  - Effort: 2h

- [x] **Step 2**: Upload JSON, validate, replace graph (confirm dialog)
  - File(s): `src/features/persistence/ImportExport.tsx` (extend), `tests/unit/features/persistence/ImportExport.upload.test.tsx`
  - Contents: `<input type="file">`; parses + validates via Zod; migrates if needed; confirmation dialog before replacing current graph.
  - Test: 100% — invalid JSON → error toast; valid → confirmation → load.
  - Effort: 3h

- [x] **Step 3**: Drag-to-drop file onto canvas
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/integration/canvas.file-drop.test.tsx`
  - Contents: `dragenter`/`dragover` preventDefault + overlay highlight; `drop` reads first file as JSON and triggers import.
  - Test: Integration — simulated `DragEvent` with a `DataTransfer` file; import flow runs.
  - Effort: 2h

- [x] **Step 4**: Integration — export → manual edit → import round-trip
  - File(s): `tests/integration/persistence.round-trip.test.ts`
  - Contents: Build graph; export; simulate minor field edit; import back; assert graph equals original + edit.
  - Test: Green.
  - Effort: 3h

## Acceptance for Stage 2

- All 4 steps `[x]` with score ≥ 90.
- 100% unit coverage on `src/features/persistence/**`.
