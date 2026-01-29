import { Link } from "react-router-dom";

import { toolRoutes } from "../data/toolRoutes";

const LandingPage = () => {
  return (
    <div className="space-y-12">
      <section className="gradient-card overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-10 shadow-2xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-900/50">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
          Phase 0.1.0
          <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          Active
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight text-slate-900 dark:text-white md:text-5xl">
          Build a polished, private PDF toolkit directly in the browser.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          PDF Workbench is a client-side suite built with React, Vite, and Tailwind. Phase 0.1.0
          lays the groundwork: routing, theming, state, and the landing experience that future tools
          will plug into.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to="/viewer"
            className="inline-flex items-center gap-3 rounded-full bg-slate-900 px-6 py-3 text-white shadow-lg shadow-slate-900/40 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 dark:bg-white dark:text-slate-900"
          >
            Jump to Viewer Plan →
          </Link>
          <a
            href="https://www.netlify.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-3 rounded-full border border-slate-900/20 px-6 py-3 text-slate-700 transition hover:border-slate-900 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-white/30 dark:text-slate-200"
          >
            Netlify Deploy Target
          </a>
        </div>
        <dl className="mt-10 grid grid-cols-1 gap-6 text-sm uppercase tracking-[0.3em] text-slate-500 md:grid-cols-3">
          <div>
            <dt>Stack</dt>
            <dd className="text-2xl font-semibold normal-case tracking-normal text-slate-900 dark:text-white">
              React + Vite + TS
            </dd>
          </div>
          <div>
            <dt>Design System</dt>
            <dd className="text-2xl font-semibold normal-case tracking-normal text-slate-900 dark:text-white">
              Tailwind + Custom Themes
            </dd>
          </div>
          <div>
            <dt>Automation</dt>
            <dd className="text-2xl font-semibold normal-case tracking-normal text-slate-900 dark:text-white">
              ESLint · Vitest · CI
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200/70 bg-white/90 p-8 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
            Foundations
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
            What ships in 0.1.0?
          </h2>
          <ul className="mt-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <li>✅ Vite React + TypeScript baseline with strict compiler settings</li>
            <li>✅ Tailwind-driven shell with expressive typography and dual themes</li>
            <li>✅ React Router layout ready for every roadmap tool</li>
            <li>✅ Zustand store powering theme + navigation state with persistence</li>
            <li>✅ ESLint, Prettier, Vitest, and GitHub Actions to protect the main branch</li>
            <li>✅ Netlify configuration placeholder for frictionless deploys</li>
          </ul>
        </article>
        <article className="rounded-3xl border border-slate-200/70 bg-white/90 p-8 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
            Next Tracks
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
            Upcoming tool drops
          </h2>
          <div className="mt-6 space-y-5">
            {toolRoutes.slice(0, 3).map((tool) => (
              <div
                key={tool.id}
                className="rounded-2xl border border-slate-200/50 p-4 dark:border-white/10"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                  <span>{tool.eta}</span>
                  <span>{tool.version}</span>
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                  {tool.label}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{tool.summary}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-dashed border-slate-300/60 p-8 text-center text-sm text-slate-500 dark:border-white/20 dark:text-slate-400">
        <p>
          Looking ahead? Each tool route above is wired for future feature development. Swap the
          placeholder view with the real workflow as soon as its milestone becomes active.
        </p>
      </section>
    </div>
  );
};

export default LandingPage;
