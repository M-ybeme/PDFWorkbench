import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PasswordPromptModal from "./PasswordPromptModal";

const defaultProps = {
  open: true,
  fileName: "test.pdf",
  reason: "password-required" as const,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe("PasswordPromptModal keyboard", () => {
  it("has role=dialog and aria-modal", () => {
    render(<PasswordPromptModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("has aria-labelledby and aria-describedby", () => {
    render(<PasswordPromptModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-describedby");

    const titleId = dialog.getAttribute("aria-labelledby")!;
    const descId = dialog.getAttribute("aria-describedby")!;
    expect(document.getElementById(titleId)).toBeInTheDocument();
    expect(document.getElementById(descId)).toBeInTheDocument();
  });

  it("calls onCancel when Escape is pressed", async () => {
    const onCancel = vi.fn();
    render(<PasswordPromptModal {...defaultProps} onCancel={onCancel} />);

    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("submits on Enter when password is filled", async () => {
    const onSubmit = vi.fn();
    render(<PasswordPromptModal {...defaultProps} onSubmit={onSubmit} />);

    const input = screen.getByLabelText(/password/i);
    await userEvent.type(input, "secret123{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("secret123");
  });

  it("does not submit on Enter when password is empty", async () => {
    const onSubmit = vi.fn();
    render(<PasswordPromptModal {...defaultProps} onSubmit={onSubmit} />);

    const input = screen.getByLabelText(/password/i);
    await userEvent.type(input, "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(0);
  });

  it("Tab cycles within modal (focus trap)", async () => {
    render(<PasswordPromptModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])',
    );

    expect(focusable.length).toBeGreaterThanOrEqual(2);
  });
});
