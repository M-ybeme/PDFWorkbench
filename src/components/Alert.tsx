import clsx from "clsx";
import type { ReactNode } from "react";

type AlertVariant = "error" | "success" | "warning" | "info";

type AlertProps = {
  variant: AlertVariant;
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
};

const variantStyles: Record<AlertVariant, string> = {
  error:
    "border-red-200 bg-red-50/80 text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100",
  success:
    "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  warning:
    "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50",
  info: "border-slate-200/80 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300",
};

const variantRole: Record<AlertVariant, "alert" | "status"> = {
  error: "alert",
  success: "status",
  warning: "alert",
  info: "status",
};

const Alert = ({ variant, children, onDismiss, dismissLabel = "Dismiss" }: AlertProps) => (
  <div
    role={variantRole[variant]}
    className={clsx("rounded-2xl border px-4 py-3 text-sm", variantStyles[variant])}
  >
    <div className="flex items-start justify-between gap-4">
      <div>{children}</div>
      {onDismiss ? (
        <button
          type="button"
          className="shrink-0 text-xs font-semibold uppercase"
          onClick={onDismiss}
        >
          {dismissLabel}
        </button>
      ) : null}
    </div>
  </div>
);

export default Alert;
