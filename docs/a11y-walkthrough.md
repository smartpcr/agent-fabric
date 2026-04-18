# Screen-Reader Manual Walkthrough

> Step-by-step guide for verifying the Flow Studio workflow editor with NVDA (Windows) and VoiceOver (macOS).
> This document covers landmark navigation, keyboard workflows, expected live-region announcements, and known gaps.

## Prerequisites

| Requirement           | NVDA (Windows)                                  | VoiceOver (macOS)        |
| --------------------- | ----------------------------------------------- | ------------------------ |
| Screen reader version | NVDA 2024.1+                                    | macOS 14 Sonoma or later |
| Browser               | Chrome 124+ or Firefox 126+                     | Safari 17+               |
| Application URL       | `http://localhost:5173` (dev) or production URL | Same                     |
| High-contrast test    | Set `data-theme="high-contrast"` on `<html>`    | Same                     |

### Starting the application

```bash
npm run dev          # development server
# or
npm run build && npm run preview   # production preview
```

---

## Part 1 — NVDA (Windows) Walkthrough

> NVDA key = **Insert** (or **Caps Lock** if configured).
> Browse mode is the default; switch to Focus mode with **NVDA+Space** when interacting with the canvas.

### 1.1 Page load & landmarks

| Action         | Keys                    | Expected announcement                                                                                                                                        |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Open page      | Navigate to URL         | "Workflow Editor, heading level 1" (hidden h1)                                                                                                               |
| List landmarks | NVDA+F7 → Landmarks tab | `main`, `complementary: Node Palette`, `complementary: Property Grid`, `toolbar: Editor toolbar`, `toolbar: Canvas controls`, `application: Workflow Canvas` |
| Jump to main   | NVDA+F7 → main          | Focus moves to `<main>` wrapper                                                                                                                              |

### 1.2 Toolbar

| Action               | Keys                   | Expected announcement                                                                                                                     |
| -------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Tab to toolbar       | **Tab** from page top  | "Editor toolbar, toolbar"                                                                                                                 |
| Move between buttons | **Left / Right Arrow** | "Undo, button, disabled" → "Redo, button, disabled" → "Snap to grid, toggle button, not pressed" → "Auto-layout, button" → "Save, button" |
| Activate Snap toggle | **Enter** or **Space** | "Snap to grid, toggle button, pressed"                                                                                                    |
| Save (with errors)   | Focus Save, **Enter**  | "Save, button, disabled" — `title` attribute read: describes validation errors                                                            |

### 1.3 Node Palette

| Action           | Keys                        | Expected announcement                                                                  |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| Tab to palette   | **Tab**                     | "Node Palette, complementary"                                                          |
| Focus search     | **Tab**                     | "Search palette, edit"                                                                 |
| Type filter text | Type "task"                 | List filters to matching items                                                         |
| Move to list     | **Tab**                     | "Node types, listbox"                                                                  |
| Navigate items   | **Down / Up Arrow**         | "Start, option" → "Task, option" → "Decision, option" → "Loop, option" → "End, option" |
| Add node         | **Enter** on focused option | Live region: "1 node selected" (polite)                                                |
| Category groups  | (Announced per group)       | "Control Flow, group" / "Logic, group" etc.                                            |

### 1.4 Canvas

> The canvas uses `role="application"`, so NVDA enters Focus/Forms mode automatically.
> All interaction is via keyboard shortcuts — browse-mode commands are suppressed.

| Action          | Keys                        | Expected announcement                     |
| --------------- | --------------------------- | ----------------------------------------- |
| Tab to canvas   | **Tab**                     | "Workflow Canvas, application"            |
| Focus a node    | **Tab** within canvas       | "Task, group" (node label + role)         |
| Select node     | **Enter** or click          | Live region: "label node selected"        |
| Delete node     | **Delete** or **Backspace** | Live region: "Selection cleared"          |
| Clear selection | **Escape**                  | Live region: "Selection cleared"          |
| Zoom in / out   | **+** / **-**               | (Visual only — no announcement)           |
| Fit to view     | **f**                       | (Visual only)                             |
| Toggle lock     | **l**                       | Lock/Unlock toggle updates `aria-pressed` |

### 1.5 Keyboard-driven connection

| Action                   | Keys                        | Expected announcement                                                                                        |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Focus source output port | **Tab** to output handle    | "output, button" (port label)                                                                                |
| Enter connect mode       | **Enter**                   | Assertive live region: "Connect mode: press arrow keys to choose target, Enter to connect, Escape to cancel" |
| Navigate targets         | **Arrow Up / Down**         | Assertive live region: "Target: label (input)"                                                               |
| Confirm connection       | **Enter**                   | Polite live region: "Connection added"                                                                       |
| Cancel connection        | **Escape**                  | Assertive live region: "Connect mode cancelled"                                                              |
| Rejected connection      | **Enter** on invalid target | Polite live region: "Connection rejected: reason"                                                            |

### 1.6 Property Grid

| Action               | Keys                         | Expected announcement                                                      |
| -------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Tab to property grid | **Tab** (with node selected) | "Property Grid, complementary"                                             |
| Heading              | Focus enters region          | "Properties, heading level 2"                                              |
| Edit node label      | Tab to label button          | "Edit node label, button"                                                  |
| Activate label edit  | **Enter**                    | "Node label, edit, current value"                                          |
| Confirm label        | **Enter**                    | Updated label announced                                                    |
| Copy node ID         | Tab to copy button           | "Copy node ID, button"                                                     |
| Form fields          | **Tab** through fields       | "fieldName, edit" with `aria-label` matching field name                    |
| Validation error     | Tab to invalid field         | "fieldName, edit, invalid" + `aria-describedby` error text, `role="alert"` |
| Validation summary   | Automatic                    | Live region (polite): "N validation errors"                                |

### 1.7 Workflow execution

| Action         | Keys                           | Expected announcement                                                |
| -------------- | ------------------------------ | -------------------------------------------------------------------- |
| Start run      | Activate Run button in toolbar | Live region: "Run run-id started"                                    |
| Node running   | (Automatic)                    | Status badge: "Running, status"                                      |
| Node succeeded | (Automatic)                    | Status badge: "Succeeded, status"                                    |
| Node failed    | (Automatic)                    | Status badge: "Failed, status"; Enter/Space on badge opens inspector |
| Run completed  | (Automatic)                    | Live region: "Run run-id completed"                                  |
| Run failed     | (Automatic)                    | Live region: "Run run-id failed"                                     |

### 1.8 Undo / Redo & History

| Action          | Keys                     | Expected announcement                                       |
| --------------- | ------------------------ | ----------------------------------------------------------- |
| Undo            | **Ctrl+Z**               | Action is undone; no explicit announcement                  |
| Redo            | **Ctrl+Y**               | Action is redone; no explicit announcement                  |
| Toolbar buttons | Tab to Undo/Redo buttons | "Undo, button" / "Redo, button" (disabled when stack empty) |

### 1.9 High-contrast theme

| Action              | Keys                                                     | Expected announcement                                                                |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Activate            | Set `data-theme="high-contrast"` on `<html>`             | No announcement (theme switch is visual)                                             |
| Visual verification | Manual inspection                                        | Black background, white text, vivid accent colors, white borders, strong focus rings |
| axe check           | Run `npx playwright test tests/e2e/highContrast.spec.ts` | 0 contrast violations                                                                |

---

## Part 2 — VoiceOver (macOS) Walkthrough

> VO key = **Control+Option** (or **Caps Lock** if configured).
> VoiceOver uses its own cursor — navigate with **VO+Right/Left Arrow**.

### 2.1 Page load & landmarks

| Action              | Keys                             | Expected announcement                                               |
| ------------------- | -------------------------------- | ------------------------------------------------------------------- |
| Open page           | Navigate to URL                  | "Workflow Editor, heading level 1"                                  |
| Open rotor          | **VO+U**                         | Landmarks list: main, complementary (×2), toolbar (×2), application |
| Jump to main        | **VO+U**, select main, **Enter** | Focus moves to `<main>`                                             |
| Quick Nav landmarks | **VO+Command+Left/Right**        | Cycles through landmark regions                                     |

### 2.2 Toolbar

| Action                | Keys                        | Expected announcement                                                                                                    |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Navigate to toolbar   | **VO+Right Arrow** or Rotor | "Editor toolbar, toolbar"                                                                                                |
| Interact with toolbar | **VO+Shift+Down Arrow**     | Enters toolbar interaction                                                                                               |
| Move between buttons  | **VO+Right / Left Arrow**   | "Undo, dimmed, button" → "Redo, dimmed, button" → "Snap to grid, toggle button" → "Auto-layout, button" → "Save, button" |
| Activate              | **VO+Space**                | Button activates                                                                                                         |
| Stop interacting      | **VO+Shift+Up Arrow**       | Exits toolbar                                                                                                            |

### 2.3 Node Palette

| Action              | Keys                               | Expected announcement                    |
| ------------------- | ---------------------------------- | ---------------------------------------- |
| Navigate to palette | Rotor → Landmarks → "Node Palette" | "Node Palette, complementary"            |
| Interact            | **VO+Shift+Down Arrow**            | Enters palette region                    |
| Search field        | **VO+Right Arrow**                 | "Search palette, search text field"      |
| Type text           | Type normally                      | Filters list; VO reads remaining options |
| Node list           | **VO+Right Arrow**                 | "Node types, list box"                   |
| Items               | **VO+Down / Up Arrow**             | "Start, option" → "Task, option" etc.    |
| Add node            | **VO+Space** (Enter) on option     | Live region: "1 node selected"           |

### 2.4 Canvas

> The canvas uses `role="application"`. VoiceOver passes keyboard events through.
> Use **VO+Shift+Down Arrow** to interact, then regular keys work as documented.

| Action               | Keys                        | Expected announcement              |
| -------------------- | --------------------------- | ---------------------------------- |
| Navigate to canvas   | Rotor or **VO+Right Arrow** | "Workflow Canvas, application"     |
| Interact with canvas | **VO+Shift+Down Arrow**     | Enters application mode            |
| Tab to nodes         | **Tab**                     | "Task, group" (node label)         |
| Select node          | **Enter**                   | Live region: "label node selected" |
| Delete               | **Delete**                  | Live region: "Selection cleared"   |
| Clear selection      | **Escape**                  | Live region: "Selection cleared"   |
| Keyboard connect     | Same as NVDA (see §1.5)     | Same assertive announcements       |
| Stop interacting     | **VO+Shift+Up Arrow**       | Exits application region           |

### 2.5 Property Grid

| Action             | Keys                         | Expected announcement                                     |
| ------------------ | ---------------------------- | --------------------------------------------------------- |
| Navigate to grid   | Rotor → "Property Grid"      | "Property Grid, complementary"                            |
| Properties heading | **VO+Right**                 | "Properties, heading level 2"                             |
| Edit label         | **VO+Right** to label button | "Edit node label, button"                                 |
| Form fields        | **VO+Right** through fields  | "fieldName, text field" with label                        |
| Invalid field      | Focus on invalid field       | "fieldName, invalid data, text field" + error description |

### 2.6 Workflow execution

Same as NVDA §1.7 — all announcements come through `aria-live="polite"` and `role="status"` regions which VoiceOver reads automatically.

### 2.7 Undo / Redo

| Action | Keys                | Expected announcement |
| ------ | ------------------- | --------------------- |
| Undo   | **Command+Z**       | Action undone         |
| Redo   | **Command+Shift+Z** | Action redone         |

---

## Part 3 — Expected Announcements Reference

Below is a consolidated list of all live-region announcements emitted by the application.

### Selection announcements (polite)

| Event                | Message                 |
| -------------------- | ----------------------- |
| Single node selected | "`label` node selected" |
| Multiple nodes       | "`N` nodes selected"    |
| Selection cleared    | "Selection cleared"     |

### Connection announcements (polite)

| Event               | Message                          |
| ------------------- | -------------------------------- |
| Edge created        | "Connection added"               |
| Edge removed        | "Connection removed"             |
| Connection success  | "Connected `source` to `target`" |
| Connection rejected | "Connection rejected: `reason`"  |

### Run-state announcements (polite)

| Event         | Message                 |
| ------------- | ----------------------- |
| Run started   | "Run `runId` started"   |
| Run completed | "Run `runId` completed" |
| Run failed    | "Run `runId` failed"    |
| Run cancelled | "Run `runId` cancelled" |

### Canvas connect mode (assertive)

| Event                | Message                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| Enter connect mode   | "Connect mode: press arrow keys to choose target, Enter to connect, Escape to cancel" |
| Target navigation    | "Target: `label` (`portName`)"                                                        |
| Connection cancelled | "Connect mode cancelled"                                                              |

### Property validation (polite)

| Event                     | Message                     |
| ------------------------- | --------------------------- |
| Validation errors present | "N validation errors"       |
| Individual field error    | Alert role on error element |

---

## Part 4 — Known Gaps & Limitations

### Functional gaps

| #   | Area                        | Description                                                                                                                  | Severity | Workaround                                                                                |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| 1   | Rapid announcements         | Multiple quick changes may overwrite each other — only one message at a time in the polite live region                       | Low      | Messages are debounced at 3s; rapid actions merge naturally                               |
| 2   | Palette category toggle     | Category collapse/expand headers lack `tabIndex` and cannot be toggled via keyboard                                          | Low      | All items are reachable via Up/Down within the listbox regardless of collapse state       |
| 3   | Node selection state        | Nodes use `data-selected` visual attribute but do not expose `aria-selected` (removed due to `role="group"` incompatibility) | Low      | Selection is announced via live region; visual styling is unambiguous                     |
| 4   | Canvas `role="application"` | Suppresses all browse-mode shortcuts; users must know the app's keyboard model                                               | Medium   | Keyboard instructions documented above; connect-mode announcement explains available keys |
| 5   | Zoom / fit announcements    | Zoom in/out and fit-to-view produce no screen-reader announcement                                                            | Low      | Visual-only operations; node content remains accessible                                   |
| 6   | Undo / redo announcements   | No explicit live-region announcement on undo/redo actions                                                                    | Low      | The resulting state change (selection, node count) triggers its own announcement          |
| 7   | Input port keyboard action  | Input handles are focusable (`role="button"`) but have no keyboard action on Enter                                           | Low      | Connections are initiated from output handles only                                        |
| 8   | Theme switch                | No programmatic announcement when switching between default, dark, and high-contrast themes                                  | Low      | Theme preference is set before page load; not a runtime interaction                       |

### Browser-specific notes

| Browser            | Notes                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Chrome + NVDA      | Fully tested; `role="application"` enters forms mode automatically                                     |
| Firefox + NVDA     | `role="application"` may require manual forms-mode switch (**NVDA+Space**)                             |
| Safari + VoiceOver | Primary tested combination for macOS; **VO+Shift+Down** required to interact with `application` region |
| Chrome + VoiceOver | Partially supported; some `aria-live` timing differences                                               |

### Contrast & visual

- High-contrast theme passes axe-core AAA contrast checks (see `tests/e2e/highContrast.spec.ts`).
- Default and dark themes target AA contrast ratios.
- Focus rings use `box-shadow` with `--color-focus-ring` token; visible in all themes.

---

## Appendix A — Quick Reference: Keyboard Shortcuts

| Context       | Key                        | Action                           |
| ------------- | -------------------------- | -------------------------------- |
| Global        | **Tab** / **Shift+Tab**    | Move focus forward / backward    |
| Global        | **Ctrl+Z** / **Ctrl+Y**    | Undo / Redo (Cmd on macOS)       |
| Global        | **Ctrl+\\** (Cmd+\\)       | Toggle side panels               |
| Palette       | **Up / Down Arrow**        | Navigate node types              |
| Palette       | **Enter**                  | Add focused node to canvas       |
| Canvas        | **Tab**                    | Cycle through nodes              |
| Canvas        | **Enter**                  | Select focused node              |
| Canvas        | **Delete** / **Backspace** | Delete selected nodes/edges      |
| Canvas        | **Escape**                 | Clear selection / cancel connect |
| Canvas        | **+** / **=**              | Zoom in                          |
| Canvas        | **-**                      | Zoom out                         |
| Canvas        | **f**                      | Fit view                         |
| Canvas        | **l**                      | Toggle lock                      |
| Output port   | **Enter**                  | Enter connect mode               |
| Connect mode  | **Arrow Up / Down**        | Choose target port               |
| Connect mode  | **Enter**                  | Confirm connection               |
| Connect mode  | **Escape**                 | Cancel connection                |
| Property grid | **Tab**                    | Navigate form fields             |
| Property grid | **Enter**                  | Edit node label / confirm        |

## Appendix B — Test Commands

```bash
# Run automated accessibility gate (axe-core, 0 violations)
npx playwright test tests/e2e/accessibility.spec.ts --project=chromium

# Run high-contrast screenshot + contrast tests
npx playwright test tests/e2e/highContrast.spec.ts --project=chromium

# Run full keyboard navigation E2E
npx playwright test tests/e2e/keyboard.spec.ts --project=chromium

# Run all unit tests
npx vitest run
```
