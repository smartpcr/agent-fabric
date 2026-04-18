# Screenshot Placeholders

This directory holds screenshots for the "Author a Workflow" user guide.

Replace each placeholder with an actual screenshot captured from the running
application.

## Required screenshots

| File                | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `editor-layout.png` | Full editor showing palette, canvas, and property grid panels    |
| `add-node.png`      | Dragging a Task node from the palette onto the canvas            |
| `connect-nodes.png` | Drawing an edge from a source output port to a target input port |
| `property-grid.png` | Property Grid panel displaying fields for a selected Task node   |
| `save-workflow.png` | Toolbar with Save button highlighted and a toast confirmation    |
| `run-workflow.png`  | Workflow mid-execution with Start succeeded and Task running     |

## How to capture

```bash
# Option 1: Manual — run the dev server and use browser DevTools
npm run dev
# Navigate to http://localhost:5173, use browser screenshot tools

# Option 2: Automated — use Playwright
npx playwright test --project=chromium -g "screenshot"
```
