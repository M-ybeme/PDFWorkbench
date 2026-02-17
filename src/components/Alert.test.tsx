import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import Alert from "./Alert";

describe("Alert", () => {
  it("renders children", () => {
    render(<Alert variant="error">Something went wrong</Alert>);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("uses role='alert' for error variant", () => {
    render(<Alert variant="error">Error</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("uses role='alert' for warning variant", () => {
    render(<Alert variant="warning">Warning</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("uses role='status' for success variant", () => {
    render(<Alert variant="success">Success</Alert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses role='status' for info variant", () => {
    render(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders dismiss button when onDismiss is provided", () => {
    const onDismiss = vi.fn();
    render(
      <Alert variant="error" onDismiss={onDismiss}>
        Error
      </Alert>,
    );
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Alert variant="error" onDismiss={onDismiss}>
        Error
      </Alert>,
    );
    await user.click(screen.getByText("Dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("uses custom dismissLabel", () => {
    render(
      <Alert variant="success" onDismiss={vi.fn()} dismissLabel="Hide">
        Done
      </Alert>,
    );
    expect(screen.getByText("Hide")).toBeInTheDocument();
  });

  it("does not render dismiss button when onDismiss is not provided", () => {
    render(<Alert variant="info">Info</Alert>);
    expect(screen.queryByText("Dismiss")).toBeNull();
  });
});
