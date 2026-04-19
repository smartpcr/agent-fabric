# User Guide Screenshots

This directory contains real UI screenshots captured from the Agent Fabric
workflow editor, used in the `docs/user-guide/author.md` tutorial.

## Included screenshots

| File                | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `editor-layout.png` | Full editor showing palette, canvas, and property grid panels  |
| `add-node.png`      | Task node dragged from the palette onto the canvas             |
| `connect-nodes.png` | Start and Task nodes with connection handles visible           |
| `property-grid.png` | Property Grid panel displaying fields for a selected Task node |
| `save-workflow.png` | Toolbar visible after Ctrl+S save action                       |
| `run-workflow.png`  | Workflow with Start and Task nodes ready for execution         |

## Recapturing

Screenshots are captured automatically by a Playwright e2e test:

```bash
npx playwright test tests/e2e/capture-screenshots.spec.ts --project=chromium
```

This builds the app, starts a preview server, interacts with the editor to
set up each documented state, and saves full-page screenshots here.
