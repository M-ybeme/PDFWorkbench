import { create } from "zustand";

import { ThemePreference, applyThemeClass, initializeTheme, persistTheme } from "../lib/theme";

type UIState = {
  theme: ThemePreference;
  navOpen: boolean;
  sidebarCollapsed: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  setNavOpen: (value: boolean) => void;
  setSidebarCollapsed: (value: boolean) => void;
};

const defaultTheme = initializeTheme();

const defaultSidebarCollapsed =
  typeof window !== "undefined" && localStorage.getItem("pdfwb-sidebar-collapsed") === "true";

export const useUIState = create<UIState>((set) => ({
  theme: defaultTheme,
  navOpen: false,
  sidebarCollapsed: defaultSidebarCollapsed,
  setTheme: (theme) => {
    applyThemeClass(theme);
    persistTheme(theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const next: ThemePreference = state.theme === "light" ? "dark" : "light";
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
