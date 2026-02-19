import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useMemo, useState } from "react";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { toolRoutes } from "../data/toolRoutes";
import ThemeToggle from "./ThemeToggle";
import { useUIState } from "../state/uiState";
import clsx from "clsx";
import logoSrc from "/PDFWorkbenchLogo.png?url";
const AppShell = () => {
  const navOpen = useUIState((state) => state.navOpen);
  const setNavOpen = useUIState((state) => state.setNavOpen);
  const sidebarCollapsed = useUIState((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUIState((state) => state.setSidebarCollapsed);
  const [isAnimating, setAnimating] = useState(false);
  const shortcuts = useMemo(
    () => [
      {
        key: "o",
        ctrl: true,
        handler: () => {
          window.dispatchEvent(new CustomEvent("pdfworkbench:open-file"));
        },
      },
    ],
    [],
  );
  useKeyboardShortcuts(shortcuts);
  const handleNavToggle = () => {
    const currentState = useUIState.getState().navOpen;
    setAnimating(true);
    setNavOpen(!currentState);
    setTimeout(() => setAnimating(false), 300);
  };
  return _jsxs("div", {
    className:
      "min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100",
    children: [
      _jsx("a", {
        href: "#main-content",
        className:
          "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg dark:focus:bg-white dark:focus:text-slate-900",
        children: "Skip to main content",
      }),
      _jsxs("div", {
        className: clsx(
          "mx-auto flex flex-col gap-8 px-4 py-8 lg:flex-row lg:py-12",
          sidebarCollapsed ? "max-w-7xl" : "max-w-6xl 2xl:max-w-7xl",
        ),
        children: [
          sidebarCollapsed
            ? _jsxs("button", {
                type: "button",
                className:
                  "fixed left-4 top-4 z-40 hidden items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/90 px-3 py-2 shadow-lg backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:hover:bg-slate-800 lg:inline-flex",
                onClick: () => setSidebarCollapsed(false),
                "aria-label": "Expand navigation",
                children: [
                  _jsx("img", {
                    src: logoSrc,
                    alt: "PDF Workbench logo",
                    className: "h-7 w-7 rounded-lg",
                  }),
                  _jsx("span", {
                    className:
                      "text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300",
                    children: "Menu",
                  }),
                ],
              })
            : null,
          _jsxs("aside", {
            className: clsx(
              "rounded-3xl border border-slate-200/60 bg-white/80 p-6 shadow-2xl shadow-slate-200/40 backdrop-blur transition-all duration-300 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-900/40 lg:sticky lg:top-8 lg:h-fit",
              sidebarCollapsed ? "lg:hidden" : "lg:w-72 2xl:w-80",
            ),
            children: [
              _jsxs("div", {
                className: "flex items-center justify-between gap-4",
                children: [
                  _jsxs(Link, {
                    to: "/",
                    className: "flex items-center gap-3 group",
                    children: [
                      _jsx("img", {
                        src: logoSrc,
                        alt: "PDF Workbench logo",
                        className: "h-10 w-10 rounded-xl",
                      }),
                      _jsxs("div", {
                        children: [
                          _jsx("p", {
                            className:
                              "text-xs uppercase tracking-[0.25em] text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors",
                            children: "PDF WORKBENCH",
                          }),
                          _jsx("p", {
                            className:
                              "font-display text-2xl font-semibold text-slate-900 dark:text-white",
                            children: "v0.8.5 Feature Gaps",
                          }),
                        ],
                      }),
                    ],
                  }),
                  _jsxs("div", {
                    className: "flex gap-2",
                    children: [
                      _jsx(ThemeToggle, {}),
                      _jsxs("button", {
                        type: "button",
                        className:
                          "hidden rounded-full border border-slate-200/70 bg-white p-2 text-slate-600 shadow hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 lg:inline-flex",
                        "aria-label": "Collapse navigation",
                        onClick: () => setSidebarCollapsed(true),
                        children: [
                          _jsx("span", { className: "sr-only", children: "Collapse navigation" }),
                          "\u2715",
                        ],
                      }),
                      _jsxs("button", {
                        type: "button",
                        className:
                          "inline-flex rounded-full border border-slate-200/70 bg-white p-2 text-slate-600 shadow hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 lg:hidden",
                        "aria-label": "Toggle navigation",
                        "aria-expanded": navOpen,
                        onClick: handleNavToggle,
                        children: [
                          _jsxs("span", {
                            className: "sr-only",
                            children: [navOpen ? "Close" : "Open", " navigation"],
                          }),
                          navOpen ? "✕" : "☰",
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              _jsxs("nav", {
                "aria-label": "Tool navigation",
                className: clsx(
                  "mt-8 space-y-2 text-sm font-medium",
                  navOpen ? "block" : "hidden lg:block",
                  isAnimating && "animate-pulse",
                ),
                children: [
                  _jsxs(NavLink, {
                    to: "/",
                    end: true,
                    className: ({ isActive }) =>
                      clsx(
                        "flex items-center justify-between rounded-2xl px-4 py-3 transition",
                        isActive
                          ? "bg-slate-900 text-white shadow-halo dark:bg-white dark:text-slate-900"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                      ),
                    onClick: () => setNavOpen(false),
                    children: [
                      _jsx("span", { children: "Overview" }),
                      _jsx("span", {
                        className: "text-xs uppercase tracking-widest text-slate-400",
                        children: "0.1.0",
                      }),
                    ],
                  }),
                  toolRoutes.map((tool) =>
                    _jsxs(
                      NavLink,
                      {
                        to: `/${tool.path}`,
                        className: ({ isActive }) =>
                          clsx(
                            "flex flex-col rounded-2xl border border-transparent px-4 py-3 transition",
                            isActive
                              ? "border-slate-900 bg-slate-900/90 text-white shadow-halo dark:border-white dark:bg-white/95 dark:text-slate-900"
                              : "text-slate-600 hover:border-slate-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-slate-800",
                          ),
                        onClick: () => setNavOpen(false),
                        children: [
                          _jsxs("span", {
                            className: "flex items-center justify-between text-base font-semibold",
                            children: [
                              tool.label,
                              _jsx("span", {
                                className:
                                  "text-xs font-medium uppercase tracking-widest text-slate-400",
                                children: tool.version,
                              }),
                            ],
                          }),
                          _jsx("span", {
                            className: "text-xs text-slate-500 dark:text-slate-400",
                            children: tool.summary,
                          }),
                        ],
                      },
                      tool.id,
                    ),
                  ),
                ],
              }),
            ],
          }),
          _jsx("main", { id: "main-content", className: "flex-1", children: _jsx(Outlet, {}) }),
        ],
      }),
    ],
  });
};
export default AppShell;
