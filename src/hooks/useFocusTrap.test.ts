import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useFocusTrap } from "./useFocusTrap";

describe("useFocusTrap", () => {
  let container: HTMLDivElement;
  let button1: HTMLButtonElement;
  let button2: HTMLButtonElement;
  let button3: HTMLButtonElement;

  beforeEach(() => {
    container = document.createElement("div");
    button1 = document.createElement("button");
    button1.textContent = "First";
    button2 = document.createElement("button");
    button2.textContent = "Second";
    button3 = document.createElement("button");
    button3.textContent = "Third";
    container.append(button1, button2, button3);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("focuses the first focusable element on activation", () => {
    const ref = { current: container };
    renderHook(() => useFocusTrap(ref, true));
    expect(document.activeElement).toBe(button1);
  });

  it("does not focus when inactive", () => {
    const ref = { current: container };
    renderHook(() => useFocusTrap(ref, false));
    expect(document.activeElement !== button1).toBe(true);
  });

  it("wraps focus forward from last to first on Tab", () => {
    const ref = { current: container };
    renderHook(() => useFocusTrap(ref, true));

    button3.focus();
    expect(document.activeElement).toBe(button3);

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      container.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button1);
  });

  it("wraps focus backward from first to last on Shift+Tab", () => {
    const ref = { current: container };
    renderHook(() => useFocusTrap(ref, true));

    button1.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      container.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button3);
  });

  it("restores focus to previously focused element on deactivation", () => {
    const outsideButton = document.createElement("button");
    outsideButton.textContent = "Outside";
    document.body.appendChild(outsideButton);
    outsideButton.focus();
    expect(document.activeElement).toBe(outsideButton);

    const ref = { current: container };
    const { rerender } = renderHook(({ active }) => useFocusTrap(ref, active), {
      initialProps: { active: true },
    });

    expect(document.activeElement).toBe(button1);

    rerender({ active: false });
    expect(document.activeElement).toBe(outsideButton);

    document.body.removeChild(outsideButton);
  });
});
