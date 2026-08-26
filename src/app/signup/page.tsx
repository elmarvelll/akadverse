// src/app/signup/page.tsx
//
// The "create account" page, reachable at /signup.
//
// Two ways to create an account here:
//   1. Fill in the form and submit -> POSTs to our own /api/register route
//      (via the shared axios instance), which hashes the password and
//      creates the User row.
//   2. Click "Continue with Google" -> NextAuth's Google OAuth flow; if the
//      Google account's email doesn't exist yet, the `signIn` callback in
//      src/lib/auth.ts creates the User row for us automatically.
//
// This must be a Client Component ("use client") because it uses React
// state (useState) and browser-only APIs like NextAuth's `signIn`.

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { SignupFormValues } from "@/types/auth";
import { signIn } from "next-auth/react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["300", "500", "600"] });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

// Small inline Google "G" logo used on the "Continue with Google" button.
// Kept as a local component (rather than an image file) so there's no extra
// network request just to render the icon.
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

export default function SignupPage() {
  const router = useRouter();

  // Controlled form state for the four signup fields.
  const [form, setForm] = useState<SignupFormValues>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  // Whether the password field shows plaintext or dots.
  const [showPassword, setShowPassword] = useState(false);

  // Tracks the credentials-form submit lifecycle so we can disable the
  // button and show a spinner while the request is in flight.
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  // Tracks the "Continue with Google" button separately from the
  // credentials form, since they're independent actions.
  const [googleLoading, setGoogleLoading] = useState(false);

  // Generic change handler shared by every text input: reads the input's
  // `name` attribute and updates the matching key in `form` state.
  const update = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.name as keyof SignupFormValues;
    setForm((current) => ({ ...current, [key]: e.target.value }));
  };

  // Handles submitting the signup form: sends the form values to our
  // /api/register backend route via the shared axios instance.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setError("");

    try {
      // axios's baseURL is "/api" (see src/lib/axios.ts), so this hits
      // /api/register.
      await api.post("/register", form);

      // Account created — send the user to sign in with their new
      // credentials.
      router.push("/login");
    } catch (err) {
      // Axios throws on non-2xx responses; pull our API's { error } message
      // out of the response body if present, otherwise show a generic one.
      const message =
        (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) ||
        "Something went wrong. Please try again.";
      setError(message);
      setStatus("error");
    }
  };

  // Handles the "Continue with Google" button: kicks off NextAuth's Google
  // OAuth redirect flow. On success, Google redirects back and NextAuth's
  // `signIn` callback (src/lib/auth.ts) creates the User row if this email
  // hasn't signed up before, then NextAuth redirects to `callbackUrl`.
  const handleGoogle = async () => {
    try {
      setGoogleLoading(true);
      await signIn("google", { callbackUrl: "/" });
    } finally {
      // If signIn resolves without a full-page redirect having happened
      // (e.g. it was blocked), reset the loading state so the button isn't
      // stuck disabled forever.
      setGoogleLoading(false);
    }
  };

  // Drives the 4-bar password-strength indicator: fills one bar per 3
  // characters typed, capped at 12 characters (4 bars x 3 chars).
  const passwordStrength = Math.min(form.password.length, 12) / 12;

  return (
    <div className={`${inter.className} min-h-screen w-full flex`}>
      <div className="flex-1 flex items-center justify-center px-6 py-16" style={{ backgroundColor: "#FDFCFA" }}>
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="text-xs tracking-[0.3em] uppercase mb-2 lg:hidden" style={{ color: "#8C7A4E" }}>Akadverse - Access</div>
            <h2 className={`${fraunces.className} text-2xl lg:text-2xl font-medium mb-1`} style={{ color: "#22261F" }}>Create your account</h2>
            <p className="text-sm" style={{ color: "#8A8D7F" }}>
              Already have one?{" "}
              <Link href="/login" className="underline underline-offset-2" style={{ color: "#22261F" }}>Sign in instead</Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-xs rounded-md px-3 py-2" style={{ backgroundColor: "#F5E6E0", color: "#8C3B22" }}>{error}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#5C6152" }}>First name</label>
                <input
                  type="text"
                  name="firstName"
                  required
                  value={form.firstName}
                  onChange={update}
                  placeholder="Ada"
                  className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                  style={{ border: "1px solid #DEDBCE", backgroundColor: "#FFFFFF", color: "#22261F" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#5C6152" }}>Last name</label>
                <input
                  type="text"
                  name="lastName"
                  required
                  value={form.lastName}
                  onChange={update}
                  placeholder="Lovelace"
                  className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                  style={{ border: "1px solid #DEDBCE", backgroundColor: "#FFFFFF", color: "#22261F" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#5C6152" }}>Email</label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={update}
                placeholder="ada@akadverse.co"
                className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                style={{ border: "1px solid #DEDBCE", backgroundColor: "#FFFFFF", color: "#22261F" }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#5C6152" }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={update}
                  placeholder="At least 8 characters"
                  className="w-full rounded-md px-3 py-2.5 pr-10 text-sm outline-none"
                  style={{ border: "1px solid #DEDBCE", backgroundColor: "#FFFFFF", color: "#22261F" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#8A8D7F" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex gap-1 mt-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full"
                    style={{ backgroundColor: passwordStrength * 4 > i ? "#C9A66B" : "#EAE7DB" }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-md py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: "#22261F", color: "#F4F1E8" }}
            >
              {status === "loading" ? <Loader2 size={15} className="animate-spin" /> : <>Create account <ArrowRight size={15} /></>}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px" style={{ backgroundColor: "#E4E1D5" }} />
              <span className="text-xs" style={{ color: "#A6A996" }}>or</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "#E4E1D5" }} />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full rounded-md py-2.5 text-sm font-medium flex items-center justify-center gap-2.5 disabled:opacity-60"
              style={{ border: "1px solid #DEDBCE", backgroundColor: "#FFFFFF", color: "#22261F" }}
            >
              {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <><GoogleMark /> Sign up with Google</>}
            </button>

            <p className="text-xs text-center pt-2" style={{ color: "#A6A996" }}>By continuing you agree to the Terms and Privacy Policy.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
