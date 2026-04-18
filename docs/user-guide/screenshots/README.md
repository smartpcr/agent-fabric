# User Guide Screenshots

This directory contains screenshot images for the "Author a Workflow"
tutorial at `docs/user-guide/author.md`.

## Included screenshots

| File                | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `editor-layout.png` | Full editor showing palette, canvas, and property grid panels    |
| `add-node.png`      | Dragging a Task node from the palette onto the canvas            |
| `connect-nodes.png` | Drawing an edge from a source output port to a target input port |
| `property-grid.png` | Property Grid panel displaying fields for a selected Task node   |
| `save-workflow.png` | Toolbar with Save button highlighted and a toast confirmation    |
| `run-workflow.png`  | Workflow mid-execution with Start succeeded and Task running     |

## Regenerating

```bash
# Regenerate placeholder images
node scripts/generate-doc-screenshots.mjs

# Or capture real screenshots from the running app
npm run dev
# Then use browser DevTools or Playwright to capture
```
