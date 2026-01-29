const STORAGE_KEY = "pdf-workbench:theme";
export const readStoredTheme = () => {
    if (typeof window === "undefined") {
        return "light";
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "dark" ? "dark" : "light";
};
export const persistTheme = (theme) => {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, theme);
};
export const applyThemeClass = (theme) => {
    if (typeof document === "undefined") {
        return;
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
};
export const initializeTheme = () => {
    const preferred = readStoredTheme();
    applyThemeClass(preferred);
    return preferred;
};
