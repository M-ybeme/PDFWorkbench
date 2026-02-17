import { create } from "zustand";
import { applyThemeClass, initializeTheme, persistTheme } from "../lib/theme";
const defaultTheme = initializeTheme();
const defaultSidebarCollapsed = typeof window !== "undefined" && localStorage.getItem("pdfwb-sidebar-collapsed") === "true";
export const useUIState = create((set) => ({
    theme: defaultTheme,
    navOpen: false,
    sidebarCollapsed: defaultSidebarCollapsed,
    setTheme: (theme) => {
        applyThemeClass(theme);
        persistTheme(theme);
        set({ theme });
    },
    toggleTheme: () => set((state) => {
        const next = state.theme === "light" ? "dark" : "light";
        applyThemeClass(next);
        persistTheme(next);
        return { theme: next };
    }),
    setNavOpen: (value) => set({ navOpen: value }),
    setSidebarCollapsed: (value) => {
        localStorage.setItem("pdfwb-sidebar-collapsed", String(value));
        set({ sidebarCollapsed: value });
    },
}));
