// src/app/signup/page.tsx
//
// The "create account" page, reachable at /signup. The role selector (attached to the email field) decides the email
// domain — see src/lib/account-domains.ts — and:
//   - Student -> the full student flow (StudentSignup.tsx): academic details, emailed 6-digit OTP, then the account is
//     created in the Main DB (User) and the E-Learning DB (StudentProfile). Also used for a NEW Google user arriving
//     with ?google=<server-signed token> (see the signIn callback in src/lib/auth.ts).
//   - Faculty / HOD / DAPU -> simple account form posting to /api/register (roles are never granted by this selector; see
//     that route). Faculty and HOD also pick a College and Department (DAPU is university-wide).
// The Role is its own dropdown field (Student / Faculty / HOD / DAPU); it fixes the email domain shown next to the email
// input, and the full resulting email is always displayed under the field.

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { SignupFormValues } from "@/types/auth";
import { PasswordInput } from "../components/password-input";
import { ThemeToggle } from "../components/theme-toggle";
import { AuthVisualPanel } from "../components/auth-visual-panel";
import { EmailDomainInput } from "../components/email-domain-input";
import { AuthSelect } from "../components/auth-select";
import { StudentSignup } from "./StudentSignup";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { ACCOUNT_TYPES, buildEmail, type AccountTypeRole } from "@/lib/account-domains";

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

const GOOGLE_ERRORS: Record<string, string> = {
  google_domain: "That Google account isn't a student account. Use your @stu.cu.edu.ng Google account to sign up as a student.",
  google_unverified: "Google couldn't verify that email address. Please use a verified account.",
};

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleToken = searchParams.get("google");
  const urlError = GOOGLE_ERRORS[searchParams.get("error") ?? ""] ?? "";
  const { isDarkMode, setIsDarkMode } = useThemePreference();

  // Local part + role combine into the full email — the role picks the domain (AGENTS.md §8).
  const [localPart, setLocalPart] = useState("");
  const [accountType, setAccountType] = useState<AccountTypeRole>("student");
  const isStudent = googleToken ? true : accountType === "student";
  // Simple form for Faculty / HOD / DAPU (unchanged behaviour).
  const [form, setForm] = useState<Omit<SignupFormValues, "email">>({ firstName: "", lastName: "", password: "", location: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  // Faculty and HOD also choose a College and Department (dropdowns from the E-Learning database).
  const needsDepartment = !isStudent && (accountType === "faculty" || accountType === "hod");
  const [orgOptions, setOrgOptions] = useState<{ colleges: { id: string; code: string; name: string }[]; departments: { id: string; collegeId: string; name: string }[] } | null>(null);
  const [collegeId, setCollegeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  useEffect(() => {
    if (!needsDepartment || orgOptions) return;
    api.get("/signup/student/options").then((r) => setOrgOptions({ colleges: r.data.colleges, departments: r.data.departments })).catch(() => setError("Couldn't load the college and department options. Please refresh."));
  }, [needsDepartment, orgOptions]);
  const departmentsOfCollege = useMemo(() => orgOptions?.departments.filter((d) => d.collegeId === collegeId) ?? [], [orgOptions, collegeId]);

  const updateField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      await api.post("/register", { ...form, email: buildEmail(localPart, accountType), ...(needsDepartment ? { collegeId, departmentId } : {}) } satisfies SignupFormValues);
      router.push("/login");
    } catch (err) {
      setError((isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || "Sign up failed. Please try again.");
      setStatus("error");
    }
  };

  const handleGoogle = async () => {
    try {
      setGoogleLoading(true);
      await signIn("google", { callbackUrl: "/" });
    } finally {
      setGoogleLoading(false);
    }
  };

  const fieldCls = `w-full px-4 py-3 border rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-base sm:text-sm ${
    isDarkMode ? "bg-[#171717] border-[#262626] text-white placeholder-[#a3a3a3]" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
  }`;

  return (
    <div className={`min-h-screen font-sans relative overflow-hidden transition-colors ${isDarkMode ? "bg-black" : "bg-gray-100"}`}>
      <ThemeToggle isDarkMode={isDarkMode} onToggle={() => setIsDarkMode((prev) => !prev)} />

      <div
        className={`w-full lg:w-[52%] flex flex-col justify-center items-center px-5 sm:px-12 lg:px-16 xl:px-20 relative z-10 min-h-screen transition-colors ${
          isDarkMode ? "bg-black" : "bg-gray-100"
        }`}
      >
        <div className="max-w-[430px] w-full min-w-0 mx-auto lg:mx-0 py-16 sm:py-10 flex flex-col items-center">
          <div className="mb-8 sm:mb-10 text-left flex flex-col items-center">
            <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 leading-tight text-center ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              Join AkadVerse
            </h1>
            <p className={`text-sm sm:text-base text-center ${isDarkMode ? "text-[#c4c4c4]" : "text-gray-600"}`}>
              {isStudent ? "Create your student account." : "Create your account."}
            </p>
          </div>

          <div className="w-full space-y-4 mb-8">
            {urlError && (
              <div role="alert" className={`text-sm p-3 rounded-lg ${isDarkMode ? "text-red-300 bg-red-900/30" : "text-red-800 bg-red-100"}`}>{urlError}</div>
            )}

            {!googleToken && (
              <AuthSelect
                id="su-role"
                label="Role"
                placeholder="Select your role"
                isDarkMode={isDarkMode}
                value={accountType}
                onChange={(v) => setAccountType(v as AccountTypeRole)}
                options={ACCOUNT_TYPES.map((t) => ({ value: t.role, label: t.label }))}
              />
            )}

            {isStudent ? (
              <StudentSignup
                isDarkMode={isDarkMode}
                localPart={localPart}
                onLocalPartChange={setLocalPart}
                accountType={accountType}
                googleToken={googleToken}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input type="text" aria-label="First name" placeholder="First name" value={form.firstName} onChange={updateField("firstName")} required className={fieldCls} />
                  <input type="text" aria-label="Last name" placeholder="Last name" value={form.lastName} onChange={updateField("lastName")} required className={fieldCls} />
                </div>
                <input type="text" aria-label="Location (optional)" placeholder="Location (optional)" value={form.location} onChange={updateField("location")} className={fieldCls} />
                {needsDepartment && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AuthSelect
                      id="su-college" label="College" placeholder="Select college" isDarkMode={isDarkMode} loading={!orgOptions && !error}
                      value={collegeId} onChange={(v) => { setCollegeId(v); setDepartmentId(""); }}
                      options={(orgOptions?.colleges ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                    />
                    <AuthSelect
                      id="su-department" label="Department" placeholder="Select department" isDarkMode={isDarkMode}
                      value={departmentId} onChange={setDepartmentId} disabled={!collegeId}
                      options={departmentsOfCollege.map((d) => ({ value: d.id, label: d.name }))}
                    />
                  </div>
                )}
                <div>
                  <span className={`mb-1.5 block text-xs font-semibold ${isDarkMode ? "text-[#d4d4d4]" : "text-gray-800"}`}>Email</span>
                  <EmailDomainInput localPart={localPart} onLocalPartChange={setLocalPart} accountType={accountType} isDarkMode={isDarkMode} />
                </div>
                <PasswordInput value={form.password} onChange={updateField("password")} placeholder="Password (at least 8 characters)" isDarkMode={isDarkMode} minLength={8} />
                {error && <div role="alert" className={`text-sm p-3 rounded-lg ${isDarkMode ? "text-red-300 bg-red-900/30" : "text-red-800 bg-red-100"}`}>{error}</div>}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {status === "loading" ? "Creating account…" : "Sign Up"}
                </button>
              </form>
            )}

            {!googleToken && (
              <>
                <div className="flex items-center gap-3 py-1">
                  <div className={`flex-1 h-px ${isDarkMode ? "bg-white/10" : "bg-gray-200"}`} />
                  <span className={`text-xs ${isDarkMode ? "text-[#a3a3a3]" : "text-gray-500"}`}>or</span>
                  <div className={`flex-1 h-px ${isDarkMode ? "bg-white/10" : "bg-gray-200"}`} />
                </div>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleLoading}
                  className={`w-full py-3 border rounded-full font-semibold text-sm flex items-center justify-center gap-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDarkMode ? "bg-[#171717] border-[#262626] text-white hover:bg-[#1f1f1f]" : "bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {googleLoading ? "Redirecting…" : (<><GoogleMark /> Continue with Google</>)}
                </button>
              </>
            )}

            <p className={`text-sm text-center pt-1 ${isDarkMode ? "text-[#c4c4c4]" : "text-gray-600"}`}>
              Already have an account?{" "}
              <Link href="/login" className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <AuthVisualPanel isDarkMode={isDarkMode} />
    </div>
  );
}
