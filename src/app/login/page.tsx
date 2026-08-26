// src/app/login/page.tsx
//
// The "sign in" page, reachable at /login.
//
// Two ways to sign in here:
//   1. Email + password -> calls NextAuth's `signIn("credentials", ...)`,
//      which internally POSTs to /api/auth/callback/credentials and runs
//      the `authorize` function in src/lib/auth.ts.
//   2. "Continue with Google" -> NextAuth's Google OAuth flow.
//
// This is also where the middleware (middleware.ts) sends unauthenticated
// visitors who tried to access a protected route, since `pages.signIn` in
// src/lib/auth.ts points here.

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Fraunces, Inter } from "next/font/google";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { LoginFormValues } from "@/types/auth";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["300", "500", "600"] });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

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
  // If src/proxy.ts bounced the user here from a specific page (e.g. they
  // tried /studashboard/e-learning while signed out), it appends
  // ?callbackUrl=<that path>. Falling back to "/" lets src/proxy.ts's
  // role-based dispatch decide where a fresh sign-in should land instead.
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Controlled form state for the email + password fields.
  const [form, setForm] = useState<LoginFormValues>({ email: "", password: "" });

  // Whether the password field shows plaintext or dots.
  const [showPassword, setShowPassword] = useState(false);

  // Tracks the credentials-form submit lifecycle so we can disable the
  // button and show a spinner while the request is in flight.
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  // Tracks the "Continue with Google" button separately from the
  // credentials form, since they're independent actions.
  const [googleLoading, setGoogleLoading] = useState(false);

  // Generic change handler shared by both text inputs: reads the input's
  // `name` attribute and updates the matching key in `form` state.
  const update = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.name as keyof LoginFormValues;
    setForm((current) => ({ ...current, [key]: e.target.value }));
  };

  // Handles submitting the login form: hands email/password to NextAuth's
  // CredentialsProvider. `redirect: false` means NextAuth returns a result
  // object instead of doing a full-page redirect itself, so we can show our
  // own error message inline and control navigation ourselves.
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
      // wrong password, or a Google-only account with no password set) —
      // NextAuth surfaces that as a generic error string here.
      setError("That email and password don't match.");
      setStatus("idle");
      return;
    }

    // Sign-in succeeded — send the user back where they came from (or "/"
    // to let src/proxy.ts's role-based dispatch pick their dashboard).
    router.push(callbackUrl);
  };

  // Handles the "Continue with Google" button: kicks off NextAuth's Google
  // OAuth redirect flow. If this email already has an account (whether
  // created via credentials or a previous Google sign-in), it just logs
  // them in; the `signIn` callback in src/lib/auth.ts only creates a new
  // User row when the email is unrecognized.
  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className={`${inter.className} min-h-screen w-full flex`}>
      <div className="flex-1 flex items-center justify-center px-6 py-16" style={{ backgroundColor: "#FDFCFA" }}>
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="text-xs tracking-[0.3em] uppercase mb-2 lg:hidden" style={{ color: "#8C7A4E" }}>Akadverse - Access</div>
            <h2 className={`${fraunces.className} text-2xl font-medium mb-1`} style={{ color: "#22261F" }}>Sign in</h2>
            <p className="text-sm" style={{ color: "#8A8D7F" }}>
              New here?{" "}
              <Link href="/signup" className="underline underline-offset-2" style={{ color: "#22261F" }}>Create an account</Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-xs rounded-md px-3 py-2" style={{ backgroundColor: "#F5E6E0", color: "#8C3B22" }}>{error}</div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#5C6152" }}>Email</label>
              <input type="email" required name="email" value={form.email} onChange={update} placeholder="ada@akadverse.co"
                className="w-full rounded-md px-3 py-2.5 text-sm outline-none" style={{ border: "1px solid #DEDBCE", backgroundColor: "#FFFFFF", color: "#22261F" }} />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#5C6152" }}>Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} name="password" required value={form.password} onChange={update} placeholder="Your passphrase"
                  className="w-full rounded-md px-3 py-2.5 pr-10 text-sm outline-none" style={{ border: "1px solid #DEDBCE", backgroundColor: "#FFFFFF", color: "#22261F" }} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#8A8D7F" }} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={status === "loading"} className="w-full rounded-md py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: "#22261F", color: "#F4F1E8" }}>
              {status === "loading" ? <Loader2 size={15} className="animate-spin" /> : <>Sign in <ArrowRight size={15} /></>}
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px" style={{ backgroundColor: "#E4E1D5" }} />
              <span className="text-xs" style={{ color: "#A6A996" }}>or</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "#E4E1D5" }} />
            </div>

            <button type="button" onClick={handleGoogle} disabled={googleLoading} className="w-full rounded-md py-2.5 text-sm font-medium flex items-center justify-center gap-2.5 disabled:opacity-60" style={{ border: "1px solid #DEDBCE", backgroundColor: "#FFFFFF", color: "#22261F" }}>
              {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <><GoogleMark /> Continue with Google</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
