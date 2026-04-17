import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HandleTooltip, formatTooltipContent } from "@/features/nodes/ports/HandleTooltip";
import { makeInputPort, makeOutputPort } from "@/domain/models/port";

afterEach(() => {
  cleanup();
});

describe("formatTooltipContent", () => {
  it("formats label · dataType · cardinality", () => {
    const port = makeInputPort({
      id: "in-1",
      label: "Data Input",
      dataType: "string",
      cardinality: "single",
    });
    expect(formatTooltipContent(port)).toBe("Data Input · string · single");
  });

  it("handles multi cardinality", () => {
    const port = makeOutputPort({
      id: "out-1",
      label: "Results",
      dataType: "json",
      cardinality: "multi",
    });
    expect(formatTooltipContent(port)).toBe("Results · json · multi");
  });

  it("handles any dataType", () => {
    const port = makeInputPort({
      id: "in-2",
      label: "Generic",
    });
    expect(formatTooltipContent(port)).toBe("Generic · any · single");
  });
});

describe("HandleTooltip", () => {
  const inputPort = makeInputPort({
    id: "in-data",
    label: "Data Input",
    dataType: "string",
    cardinality: "single",
  });

  const multiPort = makeOutputPort({
    id: "out-results",
    label: "Results",
    dataType: "json",
    cardinality: "multi",
  });

  it("renders children as the trigger", () => {
    render(
      <HandleTooltip portSpec={inputPort}>
        <button data-testid="trigger">Port</button>
      </HandleTooltip>,
    );
    expect(screen.getByTestId("trigger")).toBeInTheDocument();
  });

  it("does not show tooltip content initially", () => {
    render(
      <HandleTooltip portSpec={inputPort}>
        <button>Port</button>
      </HandleTooltip>,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on hover with correct content", async () => {
    const user = userEvent.setup();
    render(
      <HandleTooltip portSpec={inputPort}>
        <button data-testid="trigger">Port</button>
      </HandleTooltip>,
    );

    await user.hover(screen.getByTestId("trigger"));

    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(tooltip.textContent).toContain("Data Input · string · single");
  });

  it("shows tooltip on keyboard focus", async () => {
    const user = userEvent.setup();
    render(
      <HandleTooltip portSpec={inputPort}>
        <button data-testid="trigger">Port</button>
      </HandleTooltip>,
    );

    await user.tab();

    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(tooltip.textContent).toContain("Data Input · string · single");
  });

  it("displays correct content for multi-cardinality output port", async () => {
    const user = userEvent.setup();
    render(
      <HandleTooltip portSpec={multiPort}>
        <button data-testid="trigger">Port</button>
      </HandleTooltip>,
    );

    await user.hover(screen.getByTestId("trigger"));

    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(tooltip.textContent).toContain("Results · json · multi");
  });
});
