// src/app/login/page.tsx
//
// The "sign in" page, reachable at /login. Visual design matches the
// dark/light split-screen mockup you provided; the functional wiring is
// unchanged from before:
//   - Email + password calls NextAuth's `signIn("credentials", ...)`,
//     which runs the `authorize` function in src/lib/auth.ts.
//   - "Continue with Google" uses NextAuth's Google OAuth flow.
//   - Honors ?callbackUrl=... appended by src/proxy.ts when it redirects
//     an unauthenticated visitor here, and is also where src/lib/auth.ts's
//     `pages.signIn` points.
//
// The mockup's role selector was commented out on the login page in the
// version you sent (i.e. not visually present there), so it's left out of
// this page too — see src/app/signup/page.tsx for the (cosmetic-only)
// version of that selector.

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { LoginFormValues } from "@/types/auth";
import { PasswordInput } from "../components/password-input";
import { ThemeToggle } from "../components/theme-toggle";
import { AuthVisualPanel } from "../components/auth-visual-panel";
import { useThemePreference } from "@/hooks/use-theme-preference";

// Small inline Google "G" logo used on the "Continue with Google" button.
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

// `useSearchParams()` (used below to read ?callbackUrl=...) opts a page out
// of static prerendering unless it's wrapped in <Suspense> — Next.js needs
// a fallback to show for the instant before the search params are
// available on the client. This default export is just that boundary; all
// the actual page logic lives in LoginForm below.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // If src/proxy.ts bounced the user here from a specific page, it appends
  // ?callbackUrl=<that path>. Falling back to "/" lets src/proxy.ts's
  // role-based dispatch decide where a fresh sign-in should land instead.
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const { isDarkMode, setIsDarkMode } = useThemePreference();

  const [form, setForm] = useState<LoginFormValues>({ email: "", password: "" });
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const updateField = (key: keyof LoginFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: e.target.value }));
  };

  // `redirect: false` means NextAuth returns a result object instead of
  // doing a full-page redirect itself, so we can show our own error
  // message inline and control navigation ourselves.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const res = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (res?.error) {
      // `authorize()` in src/lib/auth.ts returned null (no matching user,
      // wrong password, or a Google-only account with no password set).
      setError("That email and password don't match.");
      setStatus("idle");
      return;
    }

    // Sign-in succeeded — send the user back where they came from (or "/"
    // to let src/proxy.ts's role-based dispatch pick their dashboard).
    router.push(callbackUrl);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className={`min-h-screen font-sans relative overflow-hidden transition-colors ${isDarkMode ? "bg-black" : "bg-gray-100"}`}>
      <ThemeToggle isDarkMode={isDarkMode} onToggle={() => setIsDarkMode((prev) => !prev)} />

      <div
        className={`w-full lg:w-[52%] flex flex-col justify-center items-center px-5 sm:px-12 lg:px-16 xl:px-20 relative z-10 min-h-screen transition-colors ${
          isDarkMode ? "bg-black" : "bg-gray-100"
        }`}
      >
        <div className="max-w-[430px] w-full mx-auto lg:mx-0 py-16 sm:py-10 lg:py-0 lg:-mt-20 flex flex-col items-center">
          <div className="mb-8 sm:mb-12 text-left flex flex-col items-center">
            <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 leading-tight text-center ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              Welcome to AkadVerse
            </h1>
            <p className={`text-sm sm:text-base ${isDarkMode ? "text-[#9CA3AF]" : "text-gray-600"}`}>
              Sign in to access your academic workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 mb-8">
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
              placeholder="Password"
              isDarkMode={isDarkMode}
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
              {status === "loading" ? "Signing in…" : "Log In"}
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
              {googleLoading ? "Redirecting…" : (<><GoogleMark /> Continue with Google</>)}
            </button>

            <p className={`text-sm text-center pt-1 ${isDarkMode ? "text-[#9CA3AF]" : "text-gray-600"}`}>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>

      <AuthVisualPanel isDarkMode={isDarkMode} />
    </div>
  );
}
