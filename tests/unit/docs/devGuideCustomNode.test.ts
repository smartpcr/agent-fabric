import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

describe("Developer guide — Register a Custom Node", () => {
  const docPath = resolve(ROOT, "docs/developer-guide/custom-node.md");

  it("document exists", () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it("contains a top-level heading", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toMatch(/^# .+/m);
  });

  it("covers defining a NodeSpec", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toContain("NodeSpec");
    expect(content).toContain("propertySchema");
    expect(content).toContain("defaultData");
    expect(content).toContain("ports");
  });

  it("covers registering with the NodeRegistry", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toContain("NodeRegistry");
    expect(content).toContain("registerBuiltins");
    expect(content).toContain("registry.register");
  });

  it("covers authoring a React component", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toContain("React");
    expect(content).toContain("BaseNode");
    expect(content).toContain("nodeTypes");
    expect(content).toContain("memo");
  });

  it("covers testing", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toContain("validateSpec");
    expect(content).toContain("test");
    expect(content).toContain("vitest");
  });

  it("includes code examples", () => {
    const content = readFileSync(docPath, "utf8");
    const codeBlocks = content.match(/```typescript|```tsx/g) ?? [];
    expect(codeBlocks.length).toBeGreaterThanOrEqual(4);
  });

  it("references external resources (Zod, Lucide, xyflow)", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toContain("zod.dev");
    expect(content).toContain("lucide.dev");
    expect(content).toContain("reactflow.dev");
  });

  it("includes a completion checklist", () => {
    const content = readFileSync(docPath, "utf8");
    const checkboxes = content.match(/- \[ \]/g) ?? [];
    expect(checkboxes.length).toBeGreaterThanOrEqual(5);
  });

  it("references port helpers (makeInputPort, makeOutputPort)", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toContain("makeInputPort");
    expect(content).toContain("makeOutputPort");
  });

  it("includes an Example Repository section with GitHub URL and links", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toContain("Example Repository");
    expect(content).toContain("github.com/smartpcr/agent-fabric");
    expect(content).toContain("TaskNode.spec.ts");
    expect(content).toContain("TaskNode.tsx");
    expect(content).toContain("reactflow.dev");
  });
});
