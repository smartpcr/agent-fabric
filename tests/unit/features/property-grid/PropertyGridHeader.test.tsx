import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyGridHeader } from "@/features/property-grid/PropertyGridHeader";
import { ToastProvider } from "@/features/editor/Toast";

afterEach(() => {
  cleanup();
});

describe("PropertyGridHeader", () => {
  describe("kind badge", () => {
    it("renders the node kind as a badge", () => {
      render(<PropertyGridHeader kind="task" nodeId="node-1" />);

      const badge = screen.getByTestId("header-kind-badge");
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe("task");
    });

    it("shows different kind values", () => {
      render(<PropertyGridHeader kind="decision" nodeId="node-2" />);

      expect(screen.getByTestId("header-kind-badge").textContent).toBe("decision");
    });
  });

  describe("node ID (read-only + copy)", () => {
    it("shows the node ID in monospace", () => {
      render(<PropertyGridHeader kind="task" nodeId="node-abc-123" />);

      const idEl = screen.getByTestId("header-node-id");
      expect(idEl).toBeInTheDocument();
      expect(idEl.textContent).toBe("node-abc-123");
      expect(idEl.tagName.toLowerCase()).toBe("code");
    });

    it("has a copy button", () => {
      render(<PropertyGridHeader kind="task" nodeId="node-1" />);

      const btn = screen.getByTestId("header-copy-id");
      expect(btn).toBeInTheDocument();
      expect(btn.getAttribute("aria-label")).toBe("Copy node ID");
    });

    it("copies node ID to clipboard and calls onCopyId", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      const onCopyId = vi.fn();
      render(<PropertyGridHeader kind="task" nodeId="node-xyz" onCopyId={onCopyId} />);

      fireEvent.click(screen.getByTestId("header-copy-id"));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("node-xyz");
        expect(onCopyId).toHaveBeenCalled();
      });
    });

    it("fires toast via ToastContext when no onCopyId is provided", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      render(
        <ToastProvider>
          <PropertyGridHeader kind="task" nodeId="node-toast" />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByTestId("header-copy-id"));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith("node-toast");
      });

      // Toast should appear with "Node ID copied" message
      await waitFor(() => {
        expect(screen.getByText("Node ID copied")).toBeInTheDocument();
      });
    });

    it("does not render an input for node ID (read-only)", () => {
      render(<PropertyGridHeader kind="task" nodeId="node-1" />);

      // The node ID should be in a <code> element, not an input
      const idEl = screen.getByTestId("header-node-id");
      expect(idEl.tagName.toLowerCase()).toBe("code");
    });
  });

  describe("editable label", () => {
    it("shows the label when provided", () => {
      render(<PropertyGridHeader kind="task" nodeId="n1" label="My Task" />);

      expect(screen.getByTestId("header-label")).toBeInTheDocument();
      expect(screen.getByTestId("header-label").textContent).toBe("My Task");
    });

    it("does not show label area when label is undefined", () => {
      render(<PropertyGridHeader kind="task" nodeId="n1" />);

      expect(screen.queryByTestId("header-label")).not.toBeInTheDocument();
      expect(screen.queryByTestId("header-label-input")).not.toBeInTheDocument();
    });

    it("enters edit mode on click", () => {
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      fireEvent.click(screen.getByTestId("header-label"));

      expect(screen.getByTestId("header-label-input")).toBeInTheDocument();
      expect(screen.getByTestId("header-label-input").value).toBe("Task");
    });

    it("does not enter edit mode when onLabelChange is not provided", () => {
      render(<PropertyGridHeader kind="task" nodeId="n1" label="Task" />);

      fireEvent.click(screen.getByTestId("header-label"));

      // Should stay in display mode
      expect(screen.getByTestId("header-label")).toBeInTheDocument();
      expect(screen.queryByTestId("header-label-input")).not.toBeInTheDocument();
    });

    it("commits edit on blur with changed value", () => {
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      // Enter edit mode
      fireEvent.click(screen.getByTestId("header-label"));

      const input = screen.getByTestId("header-label-input");

      // Change the value
      fireEvent.change(input, { target: { value: "Updated Task" } });
      fireEvent.blur(input);

      expect(onLabelChange).toHaveBeenCalledWith("Updated Task");
      // Should return to display mode
      expect(screen.getByTestId("header-label")).toBeInTheDocument();
    });

    it("does not call onLabelChange on blur when value is unchanged", () => {
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      fireEvent.click(screen.getByTestId("header-label"));

      const input = screen.getByTestId("header-label-input");
      // Blur without changing
      fireEvent.blur(input);

      expect(onLabelChange).not.toHaveBeenCalled();
    });

    it("commits edit on Enter key", () => {
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      fireEvent.click(screen.getByTestId("header-label"));

      const input = screen.getByTestId("header-label-input");
      fireEvent.change(input, { target: { value: "Enter Task" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onLabelChange).toHaveBeenCalledWith("Enter Task");
      expect(screen.getByTestId("header-label")).toBeInTheDocument();
    });

    it("cancels edit on Escape key", () => {
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      fireEvent.click(screen.getByTestId("header-label"));

      const input = screen.getByTestId("header-label-input");
      fireEvent.change(input, { target: { value: "something" } });
      fireEvent.keyDown(input, { key: "Escape" });

      // Should not call onLabelChange
      expect(onLabelChange).not.toHaveBeenCalled();
      // Should return to display mode with original value
      expect(screen.getByTestId("header-label").textContent).toBe("Task");
    });

    it("trims whitespace before committing", () => {
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      fireEvent.click(screen.getByTestId("header-label"));

      const input = screen.getByTestId("header-label-input");
      fireEvent.change(input, { target: { value: "  New Name  " } });
      fireEvent.blur(input);

      expect(onLabelChange).toHaveBeenCalledWith("New Name");
    });

    it("does not commit empty or whitespace-only values", () => {
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      fireEvent.click(screen.getByTestId("header-label"));

      const input = screen.getByTestId("header-label-input");
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.blur(input);

      expect(onLabelChange).not.toHaveBeenCalled();
    });

    it("focuses the input when entering edit mode", () => {
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      fireEvent.click(screen.getByTestId("header-label"));

      const input = screen.getByTestId("header-label-input");
      expect(document.activeElement).toBe(input);
    });

    it("label display has accessible role and keyboard support", async () => {
      const user = userEvent.setup();
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      const label = screen.getByTestId("header-label");
      expect(label.getAttribute("role")).toBe("button");
      expect(label.getAttribute("tabindex")).toBe("0");

      // Enter via keyboard
      label.focus();
      await user.keyboard("{Enter}");

      expect(screen.getByTestId("header-label-input")).toBeInTheDocument();
    });
  });

  describe("overall layout", () => {
    it("renders all three sections when label is provided", () => {
      render(
        <PropertyGridHeader kind="task" nodeId="node-1" label="My Task" onLabelChange={vi.fn()} />,
      );

      expect(screen.getByTestId("property-grid-header")).toBeInTheDocument();
      expect(screen.getByTestId("header-kind-badge")).toBeInTheDocument();
      expect(screen.getByTestId("header-label")).toBeInTheDocument();
      expect(screen.getByTestId("header-node-id")).toBeInTheDocument();
      expect(screen.getByTestId("header-copy-id")).toBeInTheDocument();
    });

    it("renders kind and ID without label", () => {
      render(<PropertyGridHeader kind="loop" nodeId="node-1" />);

      expect(screen.getByTestId("header-kind-badge")).toBeInTheDocument();
      expect(screen.getByTestId("header-node-id")).toBeInTheDocument();
      expect(screen.queryByTestId("header-label")).not.toBeInTheDocument();
    });

    it("cancels edit with Escape when label is undefined (no label prop)", () => {
      // This tests the `label ?? ""` branch in cancelEdit when label is undefined
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader
          kind="task"
          nodeId="n1"
          label={undefined}
          onLabelChange={onLabelChange}
        />,
      );

      // No label element to click — cannot enter edit mode
      expect(screen.queryByTestId("header-label")).not.toBeInTheDocument();
    });

    it("label span keyboard activation with Space key enters edit mode", async () => {
      const user = userEvent.setup();
      const onLabelChange = vi.fn();
      render(
        <PropertyGridHeader kind="task" nodeId="n1" label="Task" onLabelChange={onLabelChange} />,
      );

      const label = screen.getByTestId("header-label");
      label.focus();
      await user.keyboard(" ");

      expect(screen.getByTestId("header-label-input")).toBeInTheDocument();
    });

    it("copy ID uses clipboard when no onCopyId prop", async () => {
      const user = userEvent.setup();
      // Mock clipboard via Object.defineProperty since navigator.clipboard is getter-only
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });

      render(<PropertyGridHeader kind="task" nodeId="node-42" label="Task" />);

      const copyBtn = screen.getByTestId("header-copy-id");
      await user.click(copyBtn);

      expect(writeText).toHaveBeenCalledWith("node-42");
    });
  });
});
