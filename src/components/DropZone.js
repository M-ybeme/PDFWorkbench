import { jsx as _jsx } from "react/jsx-runtime";
import clsx from "clsx";
const activeColorMap = {
  indigo: "border-indigo-400 bg-indigo-50/70 dark:border-indigo-300 dark:bg-indigo-500/10",
  emerald: "border-emerald-400 bg-emerald-50/70 dark:border-emerald-300 dark:bg-emerald-500/10",
  cyan: "border-cyan-400 bg-cyan-50/70 dark:border-cyan-300 dark:bg-cyan-500/10",
  amber: "border-amber-400 bg-amber-50/80 dark:border-amber-300 dark:bg-amber-500/10",
  violet: "border-violet-400 bg-violet-50/70 dark:border-violet-300 dark:bg-violet-500/10",
};
const inactiveStyle = "border-slate-300/70 bg-white/80 dark:border-white/10 dark:bg-slate-900/60";
const DropZone = ({ isDragActive, accentColor, dropZoneProps, children, className }) =>
  _jsx("div", {
    ...dropZoneProps,
    className: clsx(
      "rounded-[32px] border-2 border-dashed p-10 transition-colors",
      isDragActive ? activeColorMap[accentColor] : inactiveStyle,
      className,
    ),
    children: children,
  });
export default DropZone;
