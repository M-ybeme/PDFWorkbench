import type { ToolRoute } from "../data/toolRoutes";
import { Link } from "react-router-dom";

type ToolPlaceholderProps = {
  tool: ToolRoute;
};

const ToolPlaceholder = ({ tool }: ToolPlaceholderProps) => {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300/70 bg-white/80 p-10 text-center shadow-sm dark:border-white/20 dark:bg-slate-900/60">
      <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
        Coming in {tool.version}
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold text-slate-900 dark:text-white">
        {tool.label}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300">
        {tool.summary}
      </p>
      <div className="mt-8 flex flex-col items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <p>
          The layout, routing, and state scaffolding are already in place. Drop your feature
          components into `src/pages` or dedicated feature modules, then update the router entry.
        </p>
        <Link
          to="/"
          className="inline-flex rounded-full bg-slate-900 px-6 py-2 text-white transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 dark:bg-white dark:text-slate-900"
        >
          ← Back to roadmap
        </Link>
      </div>
    </div>
  );
};

export default ToolPlaceholder;
