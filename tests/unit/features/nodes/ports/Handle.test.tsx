import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { InputHandle } from "@/features/nodes/ports/InputHandle";
import { OutputHandle } from "@/features/nodes/ports/OutputHandle";
import { makeInputPort, makeOutputPort, type PortSpec } from "@/domain/models/port";

// Mock @xyflow/react — render Handle as a div that exposes all props
vi.mock("@xyflow/react", () => ({
  Handle: (props: Record<string, unknown>) => (
    <div
      data-testid="xyflow-handle"
      data-handle-type={props.type as string}
      data-handle-position={props.position as string}
      data-handle-id={props.id as string}
      data-port-id={props["data-port-id"] as string}
      aria-label={props["aria-label"] as string}
      className={props.className as string}
    />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

afterEach(() => {
  cleanup();
});

describe("InputHandle", () => {
  const inputPort: PortSpec = makeInputPort({
    id: "input-data",
    label: "Data Input",
    dataType: "string",
    cardinality: "single",
  });

  it("renders with portSpec.id as the handle id", () => {
    render(<InputHandle portSpec={inputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-handle-id")).toBe("input-data");
  });

  it("sets data-port-id attribute to portSpec.id", () => {
    render(<InputHandle portSpec={inputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-port-id")).toBe("input-data");
  });

  it("sets aria-label to portSpec.label", () => {
    render(<InputHandle portSpec={inputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("aria-label")).toBe("Data Input");
  });

  it("applies type-based CSS class for dataType", () => {
    render(<InputHandle portSpec={inputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.className).toContain("port-handle");
    expect(handle.className).toContain("port-type-string");
  });

  it("renders as target (input) handle type", () => {
    render(<InputHandle portSpec={inputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-handle-type")).toBe("target");
  });

  it("defaults to top position", () => {
    render(<InputHandle portSpec={inputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-handle-position")).toBe("top");
  });

  it("accepts a custom position", () => {
    // Position is mocked at module scope; use the string value directly
    render(<InputHandle portSpec={inputPort} position={"left" as never} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-handle-position")).toBe("left");
  });

  it("applies correct class for json dataType", () => {
    const jsonPort = makeInputPort({
      id: "in-json",
      label: "JSON Input",
      dataType: "json",
    });
    render(<InputHandle portSpec={jsonPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.className).toContain("port-type-json");
  });

  it("applies correct class for any dataType", () => {
    const anyPort = makeInputPort({
      id: "in-any",
      label: "Any Input",
      dataType: "any",
    });
    render(<InputHandle portSpec={anyPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.className).toContain("port-type-any");
  });
});

describe("OutputHandle", () => {
  const outputPort: PortSpec = makeOutputPort({
    id: "output-result",
    label: "Result Output",
    dataType: "json",
    cardinality: "multi",
  });

  it("renders with portSpec.id as the handle id", () => {
    render(<OutputHandle portSpec={outputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-handle-id")).toBe("output-result");
  });

  it("sets data-port-id attribute to portSpec.id", () => {
    render(<OutputHandle portSpec={outputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-port-id")).toBe("output-result");
  });

  it("sets aria-label to portSpec.label", () => {
    render(<OutputHandle portSpec={outputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("aria-label")).toBe("Result Output");
  });

  it("applies type-based CSS class for dataType", () => {
    render(<OutputHandle portSpec={outputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.className).toContain("port-handle");
    expect(handle.className).toContain("port-type-json");
  });

  it("renders as source (output) handle type", () => {
    render(<OutputHandle portSpec={outputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-handle-type")).toBe("source");
  });

  it("defaults to bottom position", () => {
    render(<OutputHandle portSpec={outputPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-handle-position")).toBe("bottom");
  });

  it("accepts a custom position", () => {
    render(<OutputHandle portSpec={outputPort} position={"right" as never} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.getAttribute("data-handle-position")).toBe("right");
  });

  it("applies correct class for string dataType", () => {
    const stringPort = makeOutputPort({
      id: "out-str",
      label: "String Output",
      dataType: "string",
    });
    render(<OutputHandle portSpec={stringPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.className).toContain("port-type-string");
  });

  it("applies correct class for any dataType", () => {
    const anyPort = makeOutputPort({
      id: "out-any",
      label: "Any Output",
      dataType: "any",
    });
    render(<OutputHandle portSpec={anyPort} />);
    const handle = screen.getByTestId("xyflow-handle");
    expect(handle.className).toContain("port-type-any");
  });
});
