import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
const reasonCopy = {
    "password-required": {
        title: "Password required",
        message: "Enter the password to unlock this PDF.",
    },
    "password-incorrect": {
        title: "Password incorrect",
        message: "That password did not match. Please try again.",
    },
};
const PasswordPromptModal = ({ open, fileName, reason, onSubmit, onCancel, }) => {
    const [value, setValue] = useState("");
    const inputRef = useRef(null);
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
        const handleKey = (event) => {
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
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!value.trim()) {
            return;
        }
        onSubmit(value);
    };
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center px-4 py-6", children: [_jsx("div", { className: "absolute inset-0 bg-slate-900/70", "aria-hidden": "true", onClick: onCancel }), _jsx("div", { className: "relative z-10 w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500", children: copy.title }), _jsx("h2", { className: "mt-1 text-lg font-semibold text-slate-900 dark:text-white", children: fileName }), _jsx("p", { className: "mt-1 text-sm text-slate-500 dark:text-slate-300", children: copy.message })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "pdf-password", className: "text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500", children: "Password" }), _jsx("input", { id: "pdf-password", ref: inputRef, type: "password", value: value, onChange: (event) => setValue(event.target.value), className: "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-white/10 dark:bg-slate-800 dark:text-white", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsxs("div", { className: "flex justify-end gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: onCancel, className: "rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 dark:text-slate-300", children: "Cancel" }), _jsx("button", { type: "submit", className: "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900", disabled: !value.trim(), children: "Unlock PDF" })] })] }) })] }));
};
export default PasswordPromptModal;
