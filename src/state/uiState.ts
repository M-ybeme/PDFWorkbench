import { create } from "zustand";

import { ThemePreference, applyThemeClass, initializeTheme, persistTheme } from "../lib/theme";

type UIState = {
  theme: ThemePreference;
  navOpen: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  setNavOpen: (value: boolean) => void;
};

const defaultTheme = initializeTheme();

export const useUIState = create<UIState>((set) => ({
  theme: defaultTheme,
  navOpen: false,
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
}));
