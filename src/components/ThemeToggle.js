import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useUIState } from "../state/uiState";
const ThemeToggle = () => {
    const theme = useUIState((state) => state.theme);
    const toggleTheme = useUIState((state) => state.toggleTheme);
    return (_jsxs("button", { type: "button", onClick: toggleTheme, className: "inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-white/10 dark:bg-slate-800 dark:text-slate-200", "aria-pressed": theme === "dark", "aria-label": "Toggle dark mode", children: [_jsx("span", { className: "text-base", children: theme === "dark" ? "🌙" : "🌞" }), _jsx("span", { children: theme === "dark" ? "Dark" : "Light" })] }));
};
export default ThemeToggle;
