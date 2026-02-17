import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

const press = (key: string, opts: Partial<KeyboardEventInit> = {}) => {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
  return event;
};

describe("useKeyboardShortcuts", () => {
  it("calls handler when matching key is pressed", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "a", handler }]));

    press("a");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("calls handler for Ctrl+key shortcut", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "o", ctrl: true, handler }]));

    press("o", { ctrlKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not call handler when Ctrl is missing for Ctrl+key shortcut", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "o", ctrl: true, handler }]));

    press("o");
    expect(handler).toHaveBeenCalledTimes(0);
  });

  it("does not call handler when key is pressed inside an input", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "a", handler }]));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
    expect(handler).toHaveBeenCalledTimes(0);

    document.body.removeChild(input);
  });

  it("does not call handler when enabled is false", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "a", handler, enabled: false }]));

    press("a");
    expect(handler).toHaveBeenCalledTimes(0);
  });

  it("prevents default on matched shortcut", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "a", handler }]));

    const event = press("a");
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not prevent default on unmatched key", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "a", handler }]));

    const event = press("b");
    expect(event.defaultPrevented).toBe(false);
  });
});
