import { useEffect, useRef } from "react";

import { useFocusTrap } from "../hooks/useFocusTrap";
import { toolHelp } from "../data/toolHelp";

type Props = { toolId: string | null; onClose: () => void };

const ToolHelpModal = ({ toolId, onClose }: Props) => {
  const isOpen = toolId !== null && toolId in toolHelp;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isOpen, onClose]);

  if (!isOpen || !toolId) return null;
  const content = toolHelp[toolId]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-slate-900/70" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-help-title"
        aria-describedby="tool-help-desc"
        className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              About this tool
            </p>
            <h2
              id="tool-help-title"
              className="mt-1 text-xl font-semibold text-slate-900 dark:text-white"
            >
              {content.title}
            </h2>
          </div>
          <span className="mt-1 shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-widest text-slate-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
            {content.version}
          </span>
        </div>

        {/* Description */}
        <p
          id="tool-help-desc"
          className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
        >
          {content.description}
        </p>

        {/* Features */}
        <ul className="mt-4 space-y-2">
          {content.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500"
                aria-hidden="true"
              />
              {f}
            </li>
          ))}
        </ul>

        {/* Keyboard shortcuts */}
        {content.shortcuts?.length ? (
          <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 dark:border-white/10 dark:bg-slate-800/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              Keyboard shortcuts
            </p>
            <dl className="space-y-1">
              {content.shortcuts.map((s) => (
                <div key={s.keys} className="flex items-center justify-between gap-4 text-sm">
                  <dd className="text-slate-600 dark:text-slate-300">{s.description}</dd>
                  <dt>
                    <kbd className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
                      {s.keys}
                    </kbd>
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {/* Close button */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToolHelpModal;
