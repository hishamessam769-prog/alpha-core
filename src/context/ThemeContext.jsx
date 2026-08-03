import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "alpha-platform-theme";

function initialTheme() {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
    const mobileApp = window.matchMedia?.("(max-width: 767px)").matches || window.matchMedia?.("(display-mode: standalone)").matches;
    const themeColor = mobileApp
      ? (theme === "dark" ? "#071b14" : "#f7fbf4")
      : (theme === "dark" ? "#0b0f14" : "#f3f5f7");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark"),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
