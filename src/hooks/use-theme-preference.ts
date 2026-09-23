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

import { useCallback, useSyncExternalStore } from "react";

const THEME_STORAGE_KEY = "akadverse-theme";
const THEME_EVENT = "akadverse-theme-change";

// The saved choice, or the OS setting when nothing has been saved. Browser-only, so it is never used for the server render.
function readDark(): boolean {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light") return false;
    if (saved === "dark") return true;
  } catch {
    // storage blocked (private mode etc.): fall back to the OS setting
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onChange); // another tab changed it
  window.addEventListener(THEME_EVENT, onChange); // this tab changed it
  media.addEventListener("change", onChange); // the OS setting changed (only matters while nothing is saved)
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

// The server render (and React's first client render while hydrating) always uses dark, so they are identical and there is no
// hydration mismatch; the visitor's real preference is applied right after. Reading it with useSyncExternalStore instead of
// "setState inside an effect" also avoids a second render pass and stays correct if the preference changes elsewhere.
export function useThemePreference() {
  const isDarkMode = useSyncExternalStore(subscribe, readDark, () => true);

  // Same shape as a useState setter (a value or an updater), so callers are unchanged. Only an explicit toggle is saved.
  const setIsDarkMode = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(readDark()) : next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value ? "dark" : "light");
    } catch {
      // ignore: the choice just won't persist
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return { isDarkMode, setIsDarkMode } as const;
}
