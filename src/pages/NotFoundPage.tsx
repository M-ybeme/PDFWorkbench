import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-12 text-center shadow-xl dark:border-white/10 dark:bg-slate-900/70">
    <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">404</p>
    <h1 className="mt-4 font-display text-4xl font-semibold text-slate-900 dark:text-white">
      Route missing
    </h1>
    <p className="mt-4 text-slate-600 dark:text-slate-300">
      The page you were looking for is not wired yet. Choose a milestone from the roadmap panel to
      get back on track.
    </p>
    <Link
      to="/"
      className="mt-8 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-white transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 dark:bg-white dark:text-slate-900"
    >
      Return home
    </Link>
  </div>
);

export default NotFoundPage;
