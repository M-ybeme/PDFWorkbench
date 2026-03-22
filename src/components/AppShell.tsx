import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";

import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { toolRoutes } from "../data/toolRoutes";
import ThemeToggle from "./ThemeToggle";
import ToolHelpModal from "./ToolHelpModal";
import { useUIState } from "../state/uiState";
import clsx from "clsx";

import logoSrc from "/PDFWorkbenchLogo.png?url";

const APP_VERSION = "0.9.0";

const AppShell = () => {
  const navOpen = useUIState((state) => state.navOpen);
  const setNavOpen = useUIState((state) => state.setNavOpen);
  const sidebarCollapsed = useUIState((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUIState((state) => state.setSidebarCollapsed);
  const [isAnimating, setAnimating] = useState(false);
  const [helpToolId, setHelpToolId] = useState<string | null>(null);

  const location = useLocation();
  const activeToolForMobile = toolRoutes.find((tool) => location.pathname === `/${tool.path}`);

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg dark:focus:bg-white dark:focus:text-slate-900"
      >
        Skip to main content
      </a>
      <div
        className={clsx(
          "mx-auto flex flex-col gap-8 px-4 py-8 lg:flex-row lg:py-12",
          sidebarCollapsed ? "max-w-7xl" : "max-w-6xl 2xl:max-w-7xl",
        )}
      >
        {sidebarCollapsed ? (
          <button
            type="button"
            className="fixed left-4 top-4 z-40 hidden items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/90 px-3 py-2 shadow-lg backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-slate-900/90 dark:hover:bg-slate-800 lg:inline-flex"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand navigation"
          >
            <img src={logoSrc} alt="PDF Workbench logo" className="h-7 w-7 rounded-lg" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Menu
            </span>
          </button>
        ) : null}

        <aside
          className={clsx(
            "rounded-3xl border border-slate-200/60 bg-white/80 p-6 shadow-2xl shadow-slate-200/40 backdrop-blur transition-all duration-300 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-900/40 lg:sticky lg:top-8 lg:h-fit",
            sidebarCollapsed ? "lg:hidden" : "lg:w-72 2xl:w-80",
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="group flex items-center gap-3">
              <img src={logoSrc} alt="PDF Workbench logo" className="h-10 w-10 rounded-xl" />
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500 transition-colors group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
                  PDF WORKBENCH
                </p>
                <p className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
                  v{APP_VERSION}
                </p>
              </div>
            </Link>
            <div className="flex gap-2">
              <ThemeToggle />
              <button
                type="button"
                className="hidden rounded-full border border-slate-200/70 bg-white p-2 text-slate-600 shadow hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 lg:inline-flex"
                aria-label="Collapse navigation"
                onClick={() => setSidebarCollapsed(true)}
              >
                <span className="sr-only">Collapse navigation</span>✕
              </button>
              <button
                type="button"
                className="inline-flex rounded-full border border-slate-200/70 bg-white p-2 text-slate-600 shadow hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 lg:hidden"
                aria-label="Toggle navigation"
                aria-expanded={navOpen}
                onClick={handleNavToggle}
              >
                <span className="sr-only">{navOpen ? "Close" : "Open"} navigation</span>
                {navOpen ? "✕" : "☰"}
              </button>
            </div>
          </div>

          <hr className="my-5 border-slate-200/60 dark:border-white/10" />

          <nav
            aria-label="Tool navigation"
            className={clsx(
              "space-y-2 text-sm font-medium",
              navOpen ? "block" : "hidden lg:block",
              isAnimating && "animate-pulse",
            )}
          >
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                clsx(
                  "flex items-center justify-between rounded-2xl px-4 py-3 transition",
                  isActive
                    ? "bg-slate-900 text-white shadow-halo dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                )
              }
              onClick={() => setNavOpen(false)}
            >
              <span>Overview</span>
              <span className="text-xs uppercase tracking-widest text-slate-400">
                {APP_VERSION}
              </span>
            </NavLink>
            {toolRoutes.map((tool) => (
              <div key={tool.id} className="group/navrow relative flex items-stretch gap-1">
                <NavLink
                  to={`/${tool.path}`}
                  className={({ isActive }) =>
                    clsx(
                      "flex min-w-0 flex-1 flex-col rounded-2xl border border-transparent px-4 py-3 transition",
                      isActive
                        ? "border-slate-900 bg-slate-900/90 text-white shadow-halo dark:border-white dark:bg-white/95 dark:text-slate-900"
                        : "text-slate-600 hover:border-slate-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-slate-800",
                    )
                  }
                  onClick={() => setNavOpen(false)}
                >
                  <span className="flex items-center justify-between text-base font-semibold">
                    {tool.label}
                    <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
                      {tool.version}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{tool.summary}</span>
                </NavLink>
                <button
                  type="button"
                  aria-label={`Help for ${tool.label}`}
                  onClick={() => setHelpToolId(tool.id)}
                  className={clsx(
                    "flex shrink-0 items-center justify-center rounded-2xl border border-transparent px-2 text-slate-400 transition",
                    "opacity-0 focus-visible:opacity-100 group-hover/navrow:opacity-100",
                    "hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700",
                    "dark:hover:border-white/10 dark:hover:bg-slate-800 dark:hover:text-slate-200",
                    helpToolId === tool.id && "opacity-100",
                  )}
                >
                  <span aria-hidden="true" className="text-sm">
                    ?
                  </span>
                </button>
              </div>
            ))}
          </nav>
        </aside>

        <main id="main-content" className="flex-1">
          {/* Mobile tool context bar — hidden on desktop, shows current tool + ? button */}
          {activeToolForMobile ? (
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/70 lg:hidden">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {activeToolForMobile.label}
                </span>
                <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  {activeToolForMobile.version}
                </span>
              </div>
              <button
                type="button"
                aria-label={`Help for ${activeToolForMobile.label}`}
                onClick={() => setHelpToolId(activeToolForMobile.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-800 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
              >
                ?
              </button>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-slate-200/60 py-5 dark:border-white/10" role="contentinfo">
        <div
          className={clsx(
            "mx-auto px-4",
            sidebarCollapsed ? "max-w-7xl" : "max-w-6xl 2xl:max-w-7xl",
          )}
        >
          <p className="mb-4 text-center text-xs text-slate-400 dark:text-slate-600">
            Files are processed locally in your browser and are not uploaded by this application.
            Signature stamps are visual annotations only — not cryptographically secured,
            identity-verified, or compliant with electronic signature laws.
            You are responsible for the content you process. To the maximum extent permitted by
            law, this application is provided without liability for any damages arising from its use.
            Security depends on your browser, device, and extensions.{" "}
            <a
              href="https://github.com/M-ybeme/PDFWorkbench/blob/main/THIRD_PARTY_LICENSES.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-400"
            >
              Third-party licenses
            </a>
          </p>
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
            {/* Left — version */}
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-600">
              PDF Workbench v{APP_VERSION}
            </p>

            {/* Center — logo */}
            <Link
              to="/"
              className="flex items-center gap-2 opacity-60 transition hover:opacity-100"
            >
              <img src={logoSrc} alt="PDF Workbench" className="h-7 w-7 rounded-lg" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                PDF Workbench
              </span>
            </Link>

            {/* Right — social links */}
            <div className="flex items-center gap-3">
              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/in/marlo-mayberry-930ab9b7/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>

              {/* GitHub */}
              <a
                href="https://github.com/M-ybeme"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>

              {/* Ko-fi */}
              <a
                href="https://ko-fi.com/maybemestoolbox"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Support on Ko-fi"
                className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 2.318.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      <ToolHelpModal toolId={helpToolId} onClose={() => setHelpToolId(null)} />
    </div>
  );
};

export default AppShell;
