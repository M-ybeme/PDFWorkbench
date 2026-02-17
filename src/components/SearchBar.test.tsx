import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import SearchBar from "./SearchBar";

const defaultProps = {
  query: "",
  onQueryChange: vi.fn(),
  currentMatch: 0,
  totalMatches: 0,
  onNext: vi.fn(),
  onPrev: vi.fn(),
  onClose: vi.fn(),
  isSearching: false,
};

describe("SearchBar", () => {
  it("renders the search input", () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByLabelText(/search text/i)).toBeInTheDocument();
  });

  it("auto-focuses the input on mount", () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByLabelText(/search text/i)).toHaveFocus();
  });

  it("displays match count when there are matches", () => {
    render(<SearchBar {...defaultProps} query="hello" currentMatch={2} totalMatches={5} />);
    expect(screen.getByText("3 of 5")).toBeInTheDocument();
  });

  it("displays 'No matches' when query has no results", () => {
    render(<SearchBar {...defaultProps} query="xyz" totalMatches={0} />);
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("displays 'Searching...' when isSearching is true", () => {
    render(<SearchBar {...defaultProps} query="test" isSearching={true} />);
    expect(screen.getByText("Searching...")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(<SearchBar {...defaultProps} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onNext when Enter is pressed", async () => {
    const onNext = vi.fn();
    render(<SearchBar {...defaultProps} totalMatches={3} onNext={onNext} />);
    const input = screen.getByLabelText(/search text/i);
    await userEvent.type(input, "{Enter}");
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("calls onPrev when Shift+Enter is pressed", async () => {
    const onPrev = vi.fn();
    render(<SearchBar {...defaultProps} totalMatches={3} onPrev={onPrev} />);
    const input = screen.getByLabelText(/search text/i);
    await userEvent.type(input, "{Shift>}{Enter}{/Shift}");
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("has role=search for accessibility", () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByRole("search")).toBeInTheDocument();
  });
});
