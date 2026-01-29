import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import type { PdfPasswordReason } from "../lib/pdfLoader";

type PasswordPromptModalProps = {
  open: boolean;
  fileName: string;
  reason: PdfPasswordReason;
  onSubmit: (password: string) => void;
  onCancel: () => void;
};

const reasonCopy: Record<PdfPasswordReason, { title: string; message: string }> = {
  "password-required": {
    title: "Password required",
    message: "Enter the password to unlock this PDF.",
  },
  "password-incorrect": {
    title: "Password incorrect",
    message: "That password did not match. Please try again.",
  },
};

const PasswordPromptModal = ({
  open,
  fileName,
  reason,
  onSubmit,
  onCancel,
}: PasswordPromptModalProps) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    setValue("");

    const id = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);

    return () => window.clearTimeout(id);
  }, [open, reason, fileName]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  const copy = useMemo(() => reasonCopy[reason], [reason]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }

    onSubmit(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-slate-900/70" aria-hidden="true" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {copy.title}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {fileName}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{copy.message}</p>
          </div>
          <div>
            <label
              htmlFor="pdf-password"
              className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
            >
              Password
            </label>
            <input
              id="pdf-password"
              ref={inputRef}
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-white/10 dark:bg-slate-800 dark:text-white"
              placeholder="••••••••"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900"
              disabled={!value.trim()}
            >
              Unlock PDF
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordPromptModal;
