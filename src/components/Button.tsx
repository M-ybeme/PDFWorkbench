import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900",
  secondary:
    "border border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-40 dark:border-white/10 dark:text-slate-200",
  destructive:
    "border border-rose-100 text-rose-600 hover:border-rose-200 dark:border-red-900/50 dark:text-red-200",
  ghost: "text-slate-500 hover:text-slate-700 dark:text-slate-300",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-2 text-sm",
};

const Button = ({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) => (
  <button
    type="button"
    {...rest}
    className={clsx(
      "rounded-full font-semibold transition",
      variantStyles[variant],
      sizeStyles[size],
      className,
    )}
  >
    {children}
  </button>
);

export default Button;
