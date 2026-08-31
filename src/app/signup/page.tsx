// src/app/signup/page.tsx
//
// The "create account" page, reachable at /signup. Visual design matches
// the dark/light split-screen mockup you provided; the functional wiring
// underneath is unchanged from before:
//   - Credentials signup POSTs to our own /api/register route (via the
//     shared axios instance), which hashes the password and creates the
//     User row (always as role "student" — see the comment in
//     src/app/api/register/route.ts).
//   - "Sign up with Google" uses NextAuth's Google OAuth flow; if the
//     email doesn't exist yet, the `signIn` callback in src/lib/auth.ts
//     creates the User row automatically.
//
// About the "Choose View Role" selector below: it's cosmetic. Every
// account is created as "student" regardless of which pill is selected,
// and after signup the app always routes through "/" so src/proxy.ts's
// real role-based dispatch decides the destination — the selector doesn't
// override that. This was a judgment call made without an explicit
// answer from you on whether the selector should actually assign roles;
// letting a signup request self-assign Faculty/Admin would undermine the
// role system entirely, so this project defaults to the safe reading.
// Flag it if you'd rather it work differently.

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, User, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { SignupFormValues } from "@/types/auth";
import { PasswordInput } from "../components/password-input";
import { ThemeToggle } from "../components/theme-toggle";
import { AuthVisualPanel } from "../components/auth-visual-panel";
import { useThemePreference } from "@/hooks/use-theme-preference";

// Purely a display/navigation preference (see the file-level comment
// above) — NOT the role assigned to the created account.
const roleOptions = [
  { id: "student" as const, label: "Student" },
  { id: "faculty" as const, label: "Faculty" },
  { id: "admin" as const, label: "Admin" },
];

// Small inline Google "G" logo used on the "Sign up with Google" button.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4c-7.4 0-13.8 4.2-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C10.1 39.7 16.5 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.6 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

// Suspense boundary only exists because this page lives under the same
// route group conventions as /login (which needs one for useSearchParams).
// This page doesn't read search params itself, but keeping the same shape
// across both auth pages avoids one silently behaving differently from the
// other if that changes later.
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const { isDarkMode, setIsDarkMode } = useThemePreference();

  const [form, setForm] = useState<SignupFormValues>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    location: "",
  });
  const [activeRole, setActiveRole] = useState<(typeof roleOptions)[number]["id"]>("student");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const activeRoleIndex = roleOptions.findIndex((role) => role.id === activeRole);

  // Generic change handler for the plain text inputs (name/location/email).
  const updateField = (key: keyof SignupFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setError("");

    try {
      await api.post("/register", form);
      // Account created — send the user to sign in with their new
      // credentials. Deliberately NOT routed by `activeRole`: see the
      // file-level comment on why the role selector doesn't control
      // navigation.
      router.push("/login");
    } catch (err) {
      const message =
        (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) ||
        "Sign up failed. Please try again.";
      setError(message);
      setStatus("error");
    }
  };

  // "Sign up with Google" — same NextAuth flow as login; whether it creates
  // a new account or logs an existing one in is decided by the `signIn`
  // callback in src/lib/auth.ts, not by anything on this page.
  const handleGoogle = async () => {
    try {
      setGoogleLoading(true);
      await signIn("google", { callbackUrl: "/" });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className={`min-h-screen font-sans relative overflow-hidden transition-colors ${isDarkMode ? "bg-black" : "bg-gray-100"}`}>
      <ThemeToggle isDarkMode={isDarkMode} onToggle={() => setIsDarkMode((prev) => !prev)} />

      <div
        className={`w-full lg:w-[52%] flex flex-col justify-center items-center px-5 sm:px-12 lg:px-16 xl:px-20 relative z-10 min-h-screen transition-colors ${
          isDarkMode ? "bg-black" : "bg-gray-100"
        }`}
      >
        <div className="max-w-[430px] w-full mx-auto lg:mx-0 py-16 sm:py-10 flex flex-col items-center">
          <div className="mb-8 sm:mb-10 text-left flex flex-col items-center">
            <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 leading-tight text-center ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              Join AkadVerse
            </h1>
            <p className={`text-sm sm:text-base ${isDarkMode ? "text-[#9CA3AF]" : "text-gray-600"}`}>
              Create your student marketplace account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <p className={`mb-2 text-xs font-semibold uppercase tracking-widest ${isDarkMode ? "text-[#737373]" : "text-gray-500"}`}>
                Choose View Role
              </p>
              <div className={`relative grid grid-cols-3 rounded-xl p-1 ${isDarkMode ? "bg-[#0f0f0f]" : "bg-gray-100"}`}>
                <span
                  className={`absolute top-1 bottom-1 w-[calc((100%-0.5rem)/3)] rounded-lg transition-transform duration-300 ease-out ${
                    isDarkMode ? "bg-blue-500/20 border border-blue-500/30" : "bg-white border border-blue-100 shadow-sm"
                  }`}
                  style={{ transform: `translateX(calc(${activeRoleIndex} * 100%))` }}
                />
                {roleOptions.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setActiveRole(role.id)}
                    className={`relative z-10 py-2 text-sm font-semibold transition-colors ${
                      activeRole === role.id
                        ? isDarkMode
                          ? "text-white"
                          : "text-blue-700"
                        : isDarkMode
                          ? "text-[#8a8a8a] hover:text-[#c8c8c8]"
                          : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-[#737373]" : "text-gray-500"}`} size={20} />
                <input
                  type="text"
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={updateField("firstName")}
                  required
                  className={`w-full pl-12 pr-3 py-3 border rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm ${
                    isDarkMode
                      ? "bg-[#171717] border-[#262626] text-white placeholder-[#737373]"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>

              <div className="relative">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-[#737373]" : "text-gray-500"}`} size={20} />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={updateField("lastName")}
                  required
                  className={`w-full pl-12 pr-3 py-3 border rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm ${
                    isDarkMode
                      ? "bg-[#171717] border-[#262626] text-white placeholder-[#737373]"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>
            </div>

            <div className="relative">
              <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-[#737373]" : "text-gray-500"}`} size={20} />
              <input
                type="text"
                placeholder="Location (optional)"
                value={form.location}
                onChange={updateField("location")}
                className={`w-full pl-12 pr-3 py-3 border rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm ${
                  isDarkMode
                    ? "bg-[#171717] border-[#262626] text-white placeholder-[#737373]"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                }`}
              />
            </div>

            <div className="relative">
              <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-[#737373]" : "text-gray-500"}`} size={20} />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={updateField("email")}
                required
                className={`w-full pl-12 pr-3 py-3 border rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm ${
                  isDarkMode
                    ? "bg-[#171717] border-[#262626] text-white placeholder-[#737373]"
                    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                }`}
              />
            </div>

            <PasswordInput
              value={form.password}
              onChange={updateField("password")}
              placeholder="Password (at least 8 characters)"
              isDarkMode={isDarkMode}
              minLength={8}
            />

            {error && (
              <div className={`text-sm p-3 rounded-lg ${isDarkMode ? "text-red-400 bg-red-900/20" : "text-red-700 bg-red-100"}`}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {status === "loading" ? "Creating account…" : "Sign Up"}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className={`flex-1 h-px ${isDarkMode ? "bg-white/10" : "bg-gray-200"}`} />
              <span className={`text-xs ${isDarkMode ? "text-[#737373]" : "text-gray-400"}`}>or</span>
              <div className={`flex-1 h-px ${isDarkMode ? "bg-white/10" : "bg-gray-200"}`} />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className={`w-full py-3 border rounded-full font-semibold text-sm flex items-center justify-center gap-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode
                  ? "bg-[#171717] border-[#262626] text-white hover:bg-[#1f1f1f]"
                  : "bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
              }`}
            >
              {googleLoading ? "Redirecting…" : (<><GoogleMark /> Sign up with Google</>)}
            </button>

            <p className={`text-sm text-center pt-1 ${isDarkMode ? "text-[#9CA3AF]" : "text-gray-600"}`}>
              Already have an account?{" "}
              <Link href="/login" className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>

      <AuthVisualPanel isDarkMode={isDarkMode} />
    </div>
  );
}
