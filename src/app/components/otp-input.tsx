// src/app/components/otp-input.tsx
//
// One-field 6-digit code input: numeric keypad on phones, one-time-code autofill, paste-friendly (non-digits are
// stripped), large centered digits so every character is clearly readable in dark and light mode.

"use client";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  isDarkMode: boolean;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, isDarkMode, disabled }: OtpInputProps) {
  return (
    <div>
      <label htmlFor="signup-otp" className={`mb-1.5 block text-xs font-semibold ${isDarkMode ? "text-[#d4d4d4]" : "text-gray-800"}`}>
        6-digit verification code
      </label>
      <input
        id="signup-otp"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="••••••"
        aria-label="6-digit verification code"
        className={`w-full rounded-2xl border px-4 py-3.5 text-center text-2xl font-semibold tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 ${
          isDarkMode ? "border-[#262626] bg-[#171717] text-white placeholder-[#737373]" : "border-gray-300 bg-white text-gray-900 placeholder-gray-400"
        }`}
      />
    </div>
  );
}
