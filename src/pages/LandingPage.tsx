import { Link } from "react-router-dom";

import { toolRoutes } from "../data/toolRoutes";
import { useActivityLog, type ActivityCategory } from "../state/activityLog";

const badgeStyles: Record<ActivityCategory, string> = {
  merge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200",
  "split-selection": "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200",
  "split-preset": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200",
  "page-edit": "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-200",
  "images-to-pdf": "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200",
};

const formatActivityTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);

const LandingPage = () => {
  const entries = useActivityLog((state) => state.entries);
  const clearActivity = useActivityLog((state) => state.clear);
  const upcomingTools = toolRoutes.filter((tool) => tool.status === "upcoming");
  const featuredUpcoming = upcomingTools.slice(0, 3);

  return (
    <div className="space-y-12">
      <section className="gradient-card overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-10 shadow-2xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-slate-900/50">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">
          Phase 0.5.0
          <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          Shipping
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight text-slate-900 dark:text-white md:text-5xl">
          Edit PDFs and build polished exports without leaving the browser.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          PDF Workbench now layers page-level editing and the new Images→PDF studio on top of the
          viewer, merge, and split flows. Drag files, reorder or rotate pages, auto-repair images,
          and export multi-page PDFs instantly—all in the same tab.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to="/images"
            className="inline-flex items-center gap-3 rounded-full bg-slate-900 px-6 py-3 text-white shadow-lg shadow-slate-900/40 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 dark:bg-white dark:text-slate-900"
          >
            Try Images → PDF →
          </Link>
          <Link
            to="/editor"
            className="inline-flex items-center gap-3 rounded-full border border-slate-900/20 px-6 py-3 text-slate-700 transition hover:border-slate-900 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-white/30 dark:text-slate-200"
          >
            Review Page Editor
          </Link>
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
            Phase 0.3.0
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
            What's live right now?
          </h2>
          <ul className="mt-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <li>✅ PDF viewer with drag/drop ingest, zoom presets, metadata, and thumbnail rail</li>
            <li>✅ Merge workspace to stack, reorder, and download multi-file bundles instantly</li>
            <li>✅ Split workspace with selectable tiles, custom exports, and every-N ZIP bundles</li>
            <li>✅ Page editor with drag-to-reorder, rotate/delete controls, and undo history</li>
            <li>✅ Images→PDF studio with layout presets, PNG integrity guard, and instant downloads</li>
            <li>✅ Password prompts, local activity log, and Playwright coverage for merge/editor/images</li>
            <li>✅ Light/dark theming, responsive shell, and ESLint+Vitest+CI keeping the stack honest</li>
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
            {featuredUpcoming.length > 0 ? (
              featuredUpcoming.map((tool) => (
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
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200/70 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                Every announced tool is live—compression and signatures are next up once 0.6.0
                planning wraps.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white/90 p-8 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
              Workspace pulse
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Recent activity
            </h2>
          </div>
          <button
            type="button"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300"
            onClick={clearActivity}
            disabled={entries.length === 0}
          >
            Clear log
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">
            Interact with the merge or split workspaces to populate this feed. We keep the last
            dozen actions locally so you can see what shipped most recently.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {entries.slice(0, 6).map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border border-slate-200/60 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyles[entry.type]}`}
                  >
                    {entry.type === "merge"
                      ? "Merge"
                      : entry.type === "split-selection"
                        ? "Split selection"
                        : entry.type === "split-preset"
                          ? "Split bundle"
                          : entry.type === "page-edit"
                            ? "Page edits"
                            : "Images → PDF"}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {formatActivityTime(entry.timestamp)}
                  </span>
                </div>
                <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                  {entry.label}
                </p>
                {entry.detail ? (
                  <p className="text-sm text-slate-500 dark:text-slate-300">{entry.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
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
