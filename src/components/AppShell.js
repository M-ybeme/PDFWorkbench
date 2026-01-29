import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { toolRoutes } from "../data/toolRoutes";
import ThemeToggle from "./ThemeToggle";
import { useUIState } from "../state/uiState";
import clsx from "clsx";
const AppShell = () => {
    const navOpen = useUIState((state) => state.navOpen);
    const setNavOpen = useUIState((state) => state.setNavOpen);
    const [isAnimating, setAnimating] = useState(false);
    const handleNavToggle = () => {
        setAnimating(true);
        setNavOpen(!navOpen);
        setTimeout(() => setAnimating(false), 300);
    };
    return (_jsx("div", { className: "min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100", children: _jsxs("div", { className: "mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:py-12", children: [_jsxs("aside", { className: "rounded-3xl border border-slate-200/60 bg-white/80 p-6 shadow-2xl shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-900/40 lg:sticky lg:top-8 lg:h-fit lg:w-72", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400", children: "PDF WORKBENCH" }), _jsx("p", { className: "font-display text-2xl font-semibold text-slate-900 dark:text-white", children: "v0.1 Foundations" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(ThemeToggle, {}), _jsxs("button", { type: "button", className: "inline-flex rounded-full border border-slate-200/70 bg-white p-2 text-slate-600 shadow hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-200", "aria-label": "Toggle navigation", onClick: handleNavToggle, children: [_jsx("span", { className: "sr-only", children: "Open navigation" }), "\u2630"] })] })] }), _jsxs("nav", { className: clsx("mt-8 space-y-2 text-sm font-medium", navOpen ? "block" : "hidden lg:block", isAnimating && "animate-pulse"), children: [_jsxs(NavLink, { to: "/", end: true, className: ({ isActive }) => clsx("flex items-center justify-between rounded-2xl px-4 py-3 transition", isActive
                                        ? "bg-slate-900 text-white shadow-halo dark:bg-white dark:text-slate-900"
                                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"), onClick: () => setNavOpen(false), children: [_jsx("span", { children: "Overview" }), _jsx("span", { className: "text-xs uppercase tracking-widest text-slate-400", children: "0.1.0" })] }), toolRoutes.map((tool) => (_jsxs(NavLink, { to: `/${tool.path}`, className: ({ isActive }) => clsx("flex flex-col rounded-2xl border border-transparent px-4 py-3 transition", isActive
                                        ? "border-slate-900 bg-slate-900/90 text-white shadow-halo dark:border-white dark:bg-white/95 dark:text-slate-900"
                                        : "text-slate-600 hover:border-slate-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-slate-800"), onClick: () => setNavOpen(false), children: [_jsxs("span", { className: "flex items-center justify-between text-base font-semibold", children: [tool.label, _jsx("span", { className: "text-xs font-medium uppercase tracking-widest text-slate-400", children: tool.version })] }), _jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: tool.summary })] }, tool.id)))] })] }), _jsx("main", { className: "flex-1", children: _jsx(Outlet, {}) })] }) }));
};
export default AppShell;
