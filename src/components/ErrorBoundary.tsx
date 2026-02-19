import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";

type FallbackProps = {
  error: Error;
  toolName: string | undefined;
  onReset: () => void;
};

const FallbackUI = ({ error, toolName, onReset }: FallbackProps) => (
  <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
    <div className="w-full max-w-lg rounded-3xl border border-red-200/70 bg-white/90 p-8 shadow-xl shadow-red-100/40 dark:border-red-900/40 dark:bg-slate-900/80 dark:shadow-slate-900/40">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
        <svg
          className="h-6 w-6 text-red-600 dark:text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {toolName ? `Something went wrong in the ${toolName} tool` : "Something went wrong"}
      </h2>

      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        An unexpected error occurred. Your files have not been modified. You can try again or return
        to the tool list.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onReset}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Try again
        </button>
        <Link
          to="/"
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-white/20 dark:text-slate-300 dark:hover:border-white/40 dark:hover:text-white"
        >
          ← Back to tools
        </Link>
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          Error details
        </summary>
        <pre className="mt-2 overflow-auto rounded-xl bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {error.message}
        </pre>
      </details>
    </div>
  </div>
);

type Props = {
  children: ReactNode;
  toolName?: string;
};

type State = {
  error: Error | null;
};

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <FallbackUI
          error={this.state.error}
          toolName={this.props.toolName}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
