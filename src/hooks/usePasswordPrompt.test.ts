import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePasswordPrompt } from "./usePasswordPrompt";

describe("usePasswordPrompt", () => {
  it("starts with no prompt", () => {
    const { result } = renderHook(() => usePasswordPrompt());
    expect(result.current.passwordPrompt).toBeNull();
  });

  it("opens the prompt when requestPassword is invoked and resolves it on submit", async () => {
    const { result } = renderHook(() => usePasswordPrompt());

    let resolved: string | null | undefined;
    act(() => {
      result.current
        .requestPassword("secret.pdf")("password-required")
        .then((value) => {
          resolved = value;
        });
    });

    expect(result.current.passwordPrompt).toEqual(
      expect.objectContaining({ fileName: "secret.pdf", reason: "password-required" }),
    );

    await act(async () => {
      result.current.submitPassword("hunter2");
    });

    expect(resolved).toBe("hunter2");
    expect(result.current.passwordPrompt).toBeNull();
  });

  it("resolves with null and clears the prompt on cancel", async () => {
    const { result } = renderHook(() => usePasswordPrompt());

    let resolved: string | null | undefined = "unset";
    act(() => {
      result.current
        .requestPassword("secret.pdf")("password-required")
        .then((value) => {
          resolved = value;
        });
    });

    await act(async () => {
      result.current.cancelPassword();
    });

    expect(resolved).toBeNull();
    expect(result.current.passwordPrompt).toBeNull();
  });

  it("submitPassword and cancelPassword are no-ops when no prompt is open", () => {
    const { result } = renderHook(() => usePasswordPrompt());

    // An uncaught throw inside act() fails the test on its own, so simply
    // calling these with nothing open is the assertion that they're safe.
    act(() => {
      result.current.submitPassword("x");
    });
    act(() => {
      result.current.cancelPassword();
    });
    expect(result.current.passwordPrompt).toBeNull();
  });

  it("supports multiple sequential requests, e.g. a password-required then password-incorrect retry", async () => {
    const { result } = renderHook(() => usePasswordPrompt());
    const requestFor = result.current.requestPassword("secret.pdf");

    act(() => {
      void requestFor("password-required");
    });
    expect(result.current.passwordPrompt?.reason).toBe("password-required");

    await act(async () => {
      result.current.submitPassword("wrong");
    });
    expect(result.current.passwordPrompt).toBeNull();

    const onResolve = vi.fn();
    act(() => {
      void requestFor("password-incorrect").then(onResolve);
    });
    expect(result.current.passwordPrompt?.reason).toBe("password-incorrect");

    await act(async () => {
      result.current.submitPassword("correct");
    });
    expect(onResolve).toHaveBeenCalledWith("correct");
  });
});
