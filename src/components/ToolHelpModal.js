import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { toolHelp } from "../data/toolHelp";
const ToolHelpModal = ({ toolId, onClose }) => {
    const isOpen = toolId !== null && toolId in toolHelp;
    const dialogRef = useRef(null);
    useFocusTrap(dialogRef, isOpen);
    useEffect(() => {
        if (!isOpen)
            return;
        const handle = (e) => {
            if (e.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", handle);
        return () => window.removeEventListener("keydown", handle);
    }, [isOpen, onClose]);
    if (!isOpen || !toolId)
        return null;
    const content = toolHelp[toolId];
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center px-4 py-6", children: [_jsx("div", { className: "absolute inset-0 bg-slate-900/70", "aria-hidden": "true", onClick: onClose }), _jsxs("div", { ref: dialogRef, role: "dialog", "aria-modal": "true", "aria-labelledby": "tool-help-title", "aria-describedby": "tool-help-desc", className: "relative z-10 w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500", children: "About this tool" }), _jsx("h2", { id: "tool-help-title", className: "mt-1 text-xl font-semibold text-slate-900 dark:text-white", children: content.title })] }), _jsx("span", { className: "mt-1 shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-widest text-slate-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300", children: content.version })] }), _jsx("p", { id: "tool-help-desc", className: "mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300", children: content.description }), _jsx("ul", { className: "mt-4 space-y-2", children: content.features.map((f) => (_jsxs("li", { className: "flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200", children: [_jsx("span", { className: "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500", "aria-hidden": "true" }), f] }, f))) }), content.shortcuts?.length ? (_jsxs("div", { className: "mt-5 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 dark:border-white/10 dark:bg-slate-800/40", children: [_jsx("p", { className: "mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500", children: "Keyboard shortcuts" }), _jsx("dl", { className: "space-y-1", children: content.shortcuts.map((s) => (_jsxs("div", { className: "flex items-center justify-between gap-4 text-sm", children: [_jsx("dd", { className: "text-slate-600 dark:text-slate-300", children: s.description }), _jsx("dt", { children: _jsx("kbd", { className: "rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-800 dark:text-slate-200", children: s.keys }) })] }, s.keys))) })] })) : null, _jsx("div", { className: "mt-6 flex justify-end", children: _jsx("button", { type: "button", onClick: onClose, className: "rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200", children: "Close" }) })] })] }));
};
export default ToolHelpModal;
