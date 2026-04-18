import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

describe("User guide — Author a Workflow", () => {
  const docPath = resolve(ROOT, "docs/user-guide/author.md");

  it("document exists", () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it("contains a top-level heading", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toMatch(/^# .+/m);
  });

  it("covers all required tutorial steps", () => {
    const content = readFileSync(docPath, "utf8");
    const requiredSections = [
      "Open the Editor",
      "Add Nodes from the Palette",
      "Connect Nodes",
      "Edit Node Properties",
      "Save the Workflow",
      "Run the Workflow",
    ];
    for (const section of requiredSections) {
      expect(content).toContain(section);
    }
  });

  it("references screenshot images", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toContain("screenshots/");
    const screenshotRefs = content.match(/screenshots\/[\w-]+\.png/g) ?? [];
    expect(screenshotRefs.length).toBeGreaterThanOrEqual(4);
  });

  it("all referenced screenshot PNGs exist on disk", () => {
    const screenshotsDir = resolve(ROOT, "docs/user-guide/screenshots");
    const requiredImages = [
      "editor-layout.png",
      "add-node.png",
      "connect-nodes.png",
      "property-grid.png",
      "save-workflow.png",
      "run-workflow.png",
    ];
    for (const img of requiredImages) {
      const imgPath = resolve(screenshotsDir, img);
      expect(existsSync(imgPath), `Missing screenshot: ${img}`).toBe(true);
    }
  });

  it("screenshot PNGs are valid PNG files", () => {
    const screenshotsDir = resolve(ROOT, "docs/user-guide/screenshots");
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const images = [
      "editor-layout.png",
      "add-node.png",
      "connect-nodes.png",
      "property-grid.png",
      "save-workflow.png",
      "run-workflow.png",
    ];
    for (const img of images) {
      const data = readFileSync(resolve(screenshotsDir, img));
      expect(data.length).toBeGreaterThan(100);
      expect(data.subarray(0, 8).equals(pngSignature), `${img} has valid PNG header`).toBe(true);
    }
  });

  it("mentions keyboard accessibility", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toMatch(/keyboard/i);
  });

  it("mentions save and auto-save", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toMatch(/auto-save/i);
    expect(content).toMatch(/Ctrl\+S/);
  });

  it("mentions run execution", () => {
    const content = readFileSync(docPath, "utf8");
    expect(content).toMatch(/Run/);
    expect(content).toMatch(/Start/);
    expect(content).toMatch(/execution/i);
  });

  it("screenshots directory exists with README", () => {
    const screenshotsDir = resolve(ROOT, "docs/user-guide/screenshots");
    expect(existsSync(screenshotsDir)).toBe(true);
    expect(existsSync(resolve(screenshotsDir, "README.md"))).toBe(true);
  });
});
