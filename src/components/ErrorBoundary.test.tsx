import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import ErrorBoundary from "./ErrorBoundary";

// Suppress console.error output that React emits for caught errors in tests.
const suppressConsoleError = () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  return () => spy.mockRestore();
};

// A child component whose throw behaviour is controlled externally.
let shouldThrow = false;
const TestChild = () => {
  if (shouldThrow) {
    throw new Error("boom");
  }
  return <div>All good</div>;
};

const renderBoundary = (toolName?: string) =>
  render(
    <MemoryRouter>
      <ErrorBoundary toolName={toolName}>
        <TestChild />
      </ErrorBoundary>
    </MemoryRouter>,
  );

describe("ErrorBoundary", () => {
  beforeEach(() => {
    shouldThrow = false;
  });

  afterEach(() => {
    shouldThrow = false;
  });

  it("renders children when there is no error", () => {
    renderBoundary();
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders fallback UI when a child throws", () => {
    const restore = suppressConsoleError();
    shouldThrow = true;
    renderBoundary("compression workspace");
    expect(
      screen.getByText("Something went wrong in the compression workspace tool"),
    ).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
    expect(screen.getByText("← Back to tools")).toBeInTheDocument();
    restore();
  });

  it("uses a generic heading when no toolName is provided", () => {
    const restore = suppressConsoleError();
    shouldThrow = true;
    renderBoundary();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    restore();
  });

  it("shows the error message in the details section", () => {
    const restore = suppressConsoleError();
    shouldThrow = true;
    renderBoundary();
    expect(screen.getByText("boom")).toBeInTheDocument();
    restore();
  });

  it("recovers and shows children after 'Try again' is clicked", async () => {
    const user = userEvent.setup();
    const restore = suppressConsoleError();

    shouldThrow = true;
    const { rerender } = renderBoundary("viewer");
    expect(screen.getByText("Try again")).toBeInTheDocument();

    // Stop throwing before clicking reset so children render cleanly.
    shouldThrow = false;
    await user.click(screen.getByText("Try again"));

    rerender(
      <MemoryRouter>
        <ErrorBoundary toolName="viewer">
          <TestChild />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
    restore();
  });
});
