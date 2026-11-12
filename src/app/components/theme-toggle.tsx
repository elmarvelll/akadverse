// src/app/components/theme-toggle.tsx
//
// The dark/light mode pill button shown top-right on the login and signup
// pages. Extracted since both pages render an identical button wired to
// the shared useThemePreference hook.

import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  isDarkMode: boolean;
  onToggle: () => void;
}

export function ThemeToggle({ isDarkMode, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`absolute top-4 right-4 sm:top-6 sm:right-6 z-30 inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border text-xs sm:text-sm font-medium transition ${
        isDarkMode
          ? "bg-white/10 border-white/20 text-white hover:bg-white/20"
          : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50"
      }`}
    >
      {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
      {/* Icon-only on the smallest screens to save space; label appears from `sm` up. */}
      <span className="hidden sm:inline">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}
