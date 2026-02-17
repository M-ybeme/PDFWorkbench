import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import clsx from "clsx";
const SearchBar = ({ query, onQueryChange, currentMatch, totalMatches, onNext, onPrev, onClose, isSearching, }) => {
    const inputRef = useRef(null);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    const matchDisplay = isSearching
        ? "Searching..."
        : query.trim()
            ? totalMatches > 0
                ? `${currentMatch + 1} of ${totalMatches}`
                : "No matches"
            : "";
    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            onClose();
        }
        else if (e.key === "Enter") {
            if (e.shiftKey) {
                onPrev();
            }
            else {
                onNext();
            }
        }
    };
    const buttonBase = "rounded-full border border-slate-300 px-2 py-0.5 text-xs font-semibold disabled:opacity-40 dark:border-white/20";
    return (_jsxs("div", { className: clsx("flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-1.5 shadow-sm", "dark:border-white/10 dark:bg-slate-800/95"), role: "search", "aria-label": "Search in PDF", children: [_jsx("input", { ref: inputRef, type: "text", value: query, onChange: (e) => onQueryChange(e.target.value), onKeyDown: handleKeyDown, placeholder: "Find in document...", className: "w-40 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500 sm:w-56", "aria-label": "Search text" }), matchDisplay ? (_jsx("span", { className: "whitespace-nowrap text-xs text-slate-500 dark:text-slate-400", children: matchDisplay })) : null, _jsx("button", { type: "button", className: buttonBase, onClick: onPrev, disabled: totalMatches === 0, "aria-label": "Previous match", title: "Previous match (Shift+Enter)", children: "\u2191" }), _jsx("button", { type: "button", className: buttonBase, onClick: onNext, disabled: totalMatches === 0, "aria-label": "Next match", title: "Next match (Enter)", children: "\u2193" }), _jsx("button", { type: "button", className: clsx(buttonBase, "px-2"), onClick: onClose, "aria-label": "Close search", title: "Close (Escape)", children: "\u00D7" })] }));
};
export default SearchBar;
