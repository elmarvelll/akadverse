// src/hooks/use-theme-preference.ts
//
// Dark/light mode toggle shared by the login and signup pages. Both pages
// had identical copies of this logic, but each read/wrote a *different*
// localStorage key ("login-theme" vs "signup-theme") — meaning toggling
// dark mode on one page wouldn't carry over to the other. Extracting one
// hook with one shared key fixes that (and means this logic only needs to
// be reasoned about, and tested, once).
//
// Defaults to dark mode: falls back to the OS-level color-scheme
// preference only when the visitor has never explicitly toggled it here.

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "akadverse-theme";

export function useThemePreference() {
  // Start `true` (dark) so the very first paint (before this runs) matches
  // what the effect below will very likely settle on, minimizing any
  // flash of the wrong theme.
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Runs once on mount to read the visitor's saved/OS preference. This has
  // to be an effect (not computed during render) because localStorage and
  // matchMedia are browser-only APIs unavailable during server rendering.
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "light") {
      setIsDarkMode(false);
      return;
    }
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      return;
    }

    // No explicit preference saved yet — fall back to the OS setting.
    setIsDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  // Persists every change so it's remembered next visit, and so it's
  // shared with whichever of /login or /signup the visitor opens next.
  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  return { isDarkMode, setIsDarkMode } as const;
}
