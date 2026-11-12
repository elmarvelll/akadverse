// src/app/components/auth-select.tsx
//
// Labelled dropdown for the auth pages, styled like the other inputs there (dark + light). A real <select> (best on
// phones: the OS picker), with visible label, readable selected value and readable option list in both themes.
// Text is 16px on small screens so iOS doesn't zoom the page on focus.

"use client";

import { ChevronDown, Loader2 } from "lucide-react";

export interface AuthSelectOption {
  value: string;
  label: string;
}

interface AuthSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AuthSelectOption[];
  placeholder: string;
  isDarkMode: boolean;
  disabled?: boolean;
  // Options are still being fetched: show "Loading…" (and lock the control) so it never looks like there are simply no options.
  loading?: boolean;
}

export function AuthSelect({ id, label, value, onChange, options, placeholder, isDarkMode, disabled, loading }: AuthSelectProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`mb-1.5 block text-xs font-semibold ${isDarkMode ? "text-[#d4d4d4]" : "text-gray-800"}`}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          disabled={disabled || loading}
          aria-busy={loading}
          className={`w-full max-w-full appearance-none rounded-2xl border py-3 pl-4 pr-10 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${
            isDarkMode ? "border-[#262626] bg-[#171717] text-white" : "border-gray-300 bg-white text-gray-900"
          } ${value ? "" : isDarkMode ? "text-[#a3a3a3]" : "text-gray-600"}`}
        >
          <option value="" disabled className="bg-white text-gray-600">
            {loading ? "Loading…" : placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-white text-gray-900">
              {o.label}
            </option>
          ))}
        </select>
        {loading ? <Loader2 size={18} aria-hidden className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin ${isDarkMode ? "text-[#a3a3a3]" : "text-gray-600"}`} /> : <ChevronDown size={18} aria-hidden className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-[#a3a3a3]" : "text-gray-600"}`} />}
      </div>
    </div>
  );
}
