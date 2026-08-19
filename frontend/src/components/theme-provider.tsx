"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";

import { getStoredAccent, applyAccent } from "@/lib/accent";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const THEME_KEY = "cr_theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}

function applyThemeClass(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

// Small external store. Reading the theme via useSyncExternalStore is
// hydration-safe and, combined with the layout effect below, needs no
// injected <script> — which React 19 refuses to render in the component tree.
const themeListeners = new Set<() => void>();

function emitThemeChange() {
  themeListeners.forEach((listener) => listener());
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

function setStoredTheme(next: Theme) {
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // ignore storage errors
  }
  applyThemeClass(next === "system" ? getSystemTheme() : next);
  emitThemeChange();
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  resolvedTheme: "dark",
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  // Apply the theme class and accent before first paint. Direct DOM
  // mutation — no setState, no injected script — so neither React nor
  // the lint rules complain.
  useLayoutEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  useLayoutEffect(() => {
    applyAccent(getStoredAccent());
  }, []);

  // Follow OS preference changes while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyThemeClass(getSystemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setStoredTheme(next), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}