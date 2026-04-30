import { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_STORAGE_KEY = "vni-theme";
const LIGHT_THEME = "light";
const DARK_THEME = "dark";

const ThemeContext = createContext(null);

function readStoredTheme() {
  if (typeof window === "undefined") return LIGHT_THEME;

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === DARK_THEME || storedTheme === LIGHT_THEME) {
    return storedTheme;
  }

  return LIGHT_THEME;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const isDarkTheme = theme === DARK_THEME;
    root.classList.toggle(DARK_THEME, isDarkTheme);
    root.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME
    );
  };

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === DARK_THEME,
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }
  return context;
}
