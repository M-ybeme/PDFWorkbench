import { create } from "zustand";
import { applyThemeClass, initializeTheme, persistTheme } from "../lib/theme";
const defaultTheme = initializeTheme();
export const useUIState = create((set) => ({
    theme: defaultTheme,
    navOpen: false,
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
}));
