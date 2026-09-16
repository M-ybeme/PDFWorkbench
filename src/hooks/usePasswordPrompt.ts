import { useCallback, useRef, useState } from "react";

import type { PdfPasswordReason } from "../lib/pdfLoader";

export type PasswordPromptState = {
  fileName: string;
  reason: PdfPasswordReason;
  resolve: (value: string | null) => void;
};

/**
 * Owns the password-prompt-modal state shared by every tool that loads a
 * PDF via `loadPdfFromFile`/`loadPdfFromSource`: `requestPassword(fileName)`
 * is the callback those loaders call (possibly more than once, e.g. on a
 * wrong password) to get the next attempt from the user.
 */
export function usePasswordPrompt() {
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPromptState | null>(null);

  // Mirrors `passwordPrompt` outside React's render cycle. submit/cancel
  // resolve the pending promise through this ref rather than a setState
  // updater — React does not guarantee invoking a functional updater for a
  // component that is already unmounting (e.g. called from an unmount
  // cleanup), so the resolve() call must not depend on that happening.
  const promptRef = useRef<PasswordPromptState | null>(null);

  const requestPassword = useCallback(
    (fileName: string) => (reason: PdfPasswordReason) =>
      new Promise<string | null>((resolve) => {
        const next = { fileName, reason, resolve };
        promptRef.current = next;
        setPasswordPrompt(next);
      }),
    [],
  );

  const submitPassword = useCallback((password: string) => {
    promptRef.current?.resolve(password);
    promptRef.current = null;
    setPasswordPrompt(null);
  }, []);

  const cancelPassword = useCallback(() => {
    promptRef.current?.resolve(null);
    promptRef.current = null;
    setPasswordPrompt(null);
  }, []);

  return { passwordPrompt, requestPassword, submitPassword, cancelPassword };
}
