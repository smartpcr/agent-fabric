# Phase 3 — Stage 2: Connection Interaction

> Live-validated drag-to-connect with snap, keyboard path, and undo.
> Status: `[ ]` not started · **Effort**: 14h

## Steps

- [x] **Step 1**: Wire `onConnect` from xyflow → `graphSlice.tryConnect`
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/unit/features/canvas/Canvas.onConnect.test.tsx`
  - Contents: Map xyflow `Connection` shape to our `{ source, sourcePort, target, targetPort }`; call store action; ignore if result is `err`.
  - Test: 100% — valid connection persisted with correct port ids.
  - Effort: 2h

- [x] **Step 2**: Live validation during drag (`isValidConnection`)
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `tests/unit/features/canvas/Canvas.isValidConnection.test.tsx`
  - Contents: xyflow's `isValidConnection` callback runs `validateConnection` against current store; returns bool; xyflow colors preview line.
  - Test: 100% — valid pair returns true; incompatible returns false.
  - Effort: 3h

- [x] **Step 3**: Rejection reason toast on invalid drop
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `src/hooks/useToast.ts` (existing), `tests/integration/connection.rejection.test.tsx`
  - Contents: If `tryConnect` returns `err`, show toast with `error.message`.
  - Test: Integration — invalid drop → toast with specific message.
  - Effort: 2h

- [x] **Step 4**: Snap to nearest compatible handle within 20px
  - File(s): `src/features/canvas/snapToHandle.ts`, `tests/unit/features/canvas/snapToHandle.test.ts`, `src/features/canvas/Canvas.tsx` (wire)
  - Contents: On pointer move during connect-drag, query handle positions; pick closest compatible within 20px radius; override drop target.
  - Test: 100% — snap math; nearest compatible chosen; > 20px means no snap.
  - Effort: 3h

- [x] **Step 5**: Keyboard connection flow
  - File(s): `src/features/canvas/Canvas.tsx` (extend), `src/features/nodes/ports/OutputHandle.tsx` (extend), `tests/integration/connection.keyboard.test.tsx`
  - Contents: Focus output handle (Tab); Enter enters connect mode; arrow keys move focus between compatible target handles; Enter confirms; Escape cancels; screen-reader announces outcome.
  - Test: Integration — full keyboard path works without mouse.
  - Effort: 3h

- [ ] **Step 6**: Undo connect + disconnect
  - File(s): `tests/integration/connection.undo.test.tsx`
  - Contents: Connect → undo → gone; disconnect via deleting edge → undo → restored.
  - Test: Green.
  - Effort: 1h

## Acceptance for Stage 2

- All 6 steps `[x]` with score ≥ 90.
- 100% unit coverage on touched files.
- Keyboard-only connection works end-to-end.
