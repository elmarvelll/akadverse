// src/app/signup/StudentSignup.tsx
//
// Student sign-up: details -> emailed 6-digit OTP -> account created (Main DB User + E-Learning StudentProfile) -> signed in.
//
// The form never decides anything security-relevant: the server rebuilds the email from local part + the Student role,
// re-checks the domain, and re-validates College -> Department -> Programme -> Level against the E-Learning database.
// A new Google user arrives here with a server-signed `googleToken`; their institutional email is shown locked
// (from the token, not typed) and no password is asked for.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, User } from "lucide-react";
import { signIn } from "next-auth/react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { EmailDomainInput } from "../components/email-domain-input";
import { PasswordInput } from "../components/password-input";
import { AuthSelect } from "../components/auth-select";
import { OtpInput } from "../components/otp-input";
import type { AccountTypeRole } from "@/lib/account-domains";

interface Options {
  colleges: { id: string; code: string; name: string }[];
  departments: { id: string; collegeId: string; name: string }[];
  programmes: { id: string; departmentId: string; code: string; name: string }[];
  levels: { value: number; label: string }[];
  studentDomain: string;
}

const messageOf = (err: unknown, fallback: string) => (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || fallback;

export function StudentSignup({
  isDarkMode,
  localPart,
  onLocalPartChange,
  accountType,
  googleToken,
}: {
  isDarkMode: boolean;
  localPart: string;
  onLocalPartChange: (v: string) => void;
  accountType: AccountTypeRole;
  googleToken: string | null;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [optionsTry, setOptionsTry] = useState(0); // bump to retry the fetch
  const [google, setGoogle] = useState<{ email: string; firstName: string; lastName: string } | null>(null);
  const [googleError, setGoogleError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matric, setMatric] = useState("");
  const [password, setPassword] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [level, setLevel] = useState("");

  const [step, setStep] = useState<"details" | "otp">("details");
  const [pending, setPending] = useState<{ id: string; email: string; mode: "create" | "link" } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    api.get<Options>("/signup/student/options").then((r) => setOptions(r.data)).catch(() => setOptionsError("Couldn't load the academic options."));
  }, [optionsTry]);

  useEffect(() => {
    if (!googleToken) return;
    api
      .get("/signup/student/google-context", { params: { token: googleToken } })
      .then((r) => {
        setGoogle(r.data);
        setFirstName((v) => v || r.data.firstName);
        setLastName((v) => v || r.data.lastName);
      })
      .catch((e) => setGoogleError(messageOf(e, "Your Google sign-up link expired. Please continue with Google again.")));
  }, [googleToken]);

  // Resend countdown (ticks only while a cooldown is running).
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const departments = useMemo(() => options?.departments.filter((d) => d.collegeId === collegeId) ?? [], [options, collegeId]);
  const programmes = useMemo(() => options?.programmes.filter((p) => p.departmentId === departmentId) ?? [], [options, departmentId]);

  const input = `w-full px-4 py-3 border rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-base sm:text-sm ${
    isDarkMode ? "bg-[#171717] border-[#262626] text-white placeholder-[#a3a3a3]" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
  }`;
  const labelCls = `mb-1.5 block text-xs font-semibold ${isDarkMode ? "text-[#d4d4d4]" : "text-gray-800"}`;
  const muted = isDarkMode ? "text-[#a3a3a3]" : "text-gray-600";

  const sendDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/signup/student/start", {
        firstName, lastName, matricNumber: matric, collegeId, departmentId, programmeId, level: Number(level),
        ...(googleToken ? { googleToken } : { localPart, password }),
      });
      setPending({ id: data.pendingId, email: data.email, mode: data.mode });
      setCooldown(data.resendAfterSeconds);
      setCode("");
      setStep("otp");
    } catch (err) {
      setError(messageOf(err, "Couldn't start sign-up. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending || busy) return; // ignore a second submit while one is running
    setBusy(true);
    setError("");
    try {
      await api.post("/signup/student/verify", { pendingId: pending.id, code });
    } catch (err) {
      setError(messageOf(err, "Couldn't verify the code. Please try again."));
      setBusy(false);
      return;
    }
    // The account now exists in both databases: start a normal session.
    if (googleToken) {
      await signIn("google", { callbackUrl: "/" });
      return;
    }
    const res = await signIn("credentials", { email: pending.email, password, redirect: false });
    if (res?.error) {
      router.push("/login");
      return;
    }
    router.push("/");
  };

  const resend = async () => {
    if (!pending || resending || cooldown > 0) return;
    setResending(true);
    setError("");
    try {
      const { data } = await api.post("/signup/student/resend", { pendingId: pending.id });
      setCooldown(data.resendAfterSeconds);
      setCode("");
    } catch (err) {
      setError(messageOf(err, "Couldn't send a new code."));
    } finally {
      setResending(false);
    }
  };

  const primary = "w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed mt-2";
  const errorBox = error && (
    <div role="alert" className={`text-sm p-3 rounded-lg ${isDarkMode ? "text-red-300 bg-red-900/30" : "text-red-800 bg-red-100"}`}>{error}</div>
  );

  // ------------------------------- step 2: the code ----------------------------------------------------------------
  if (step === "otp" && pending) {
    return (
      <form onSubmit={verify} className="space-y-4" data-testid="otp-step">
        <p className={`text-sm ${muted}`}>
          We sent a 6-digit code to <strong className={`break-all ${isDarkMode ? "text-white" : "text-gray-900"}`}>{pending.email}</strong>. Enter it below to finish creating your account.
        </p>
        {pending.mode === "link" && (
          <p className={`text-sm rounded-lg p-3 ${isDarkMode ? "bg-blue-500/15 text-blue-200" : "bg-blue-50 text-blue-900"}`}>
            You already have an AkadVerse account with this email. We&apos;ll add your student profile to it — your existing password stays the same.
          </p>
        )}
        <OtpInput value={code} onChange={setCode} isDarkMode={isDarkMode} disabled={busy} />
        {errorBox}
        <button type="submit" disabled={busy || code.length !== 6} className={primary}>
          {busy ? "Verifying…" : "Verify and create account"}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" onClick={resend} disabled={cooldown > 0 || busy || resending} aria-busy={resending} className={`font-semibold underline disabled:no-underline disabled:opacity-60 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            {resending ? "Sending a new code…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          <button type="button" disabled={busy || resending} onClick={() => { setStep("details"); setError(""); }} className={`underline ${muted}`}>
            Change my details
          </button>
        </div>
      </form>
    );
  }

  // ------------------------------- step 1: details -----------------------------------------------------------------
  if (googleToken && googleError) {
    return <div role="alert" className={`text-sm p-3 rounded-lg ${isDarkMode ? "text-red-300 bg-red-900/30" : "text-red-800 bg-red-100"}`}>{googleError}</div>;
  }
  return (
    <form onSubmit={sendDetails} className="space-y-4" data-testid="student-form">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="min-w-0">
          <label htmlFor="su-first" className={labelCls}>First name</label>
          <div className="relative">
            <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${muted}`} size={18} />
            <input id="su-first" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" className={`${input} pl-11`} placeholder="First name" />
          </div>
        </div>
        <div className="min-w-0">
          <label htmlFor="su-last" className={labelCls}>Last name</label>
          <div className="relative">
            <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${muted}`} size={18} />
            <input id="su-last" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" className={`${input} pl-11`} placeholder="Last name" />
          </div>
        </div>
      </div>

      {googleToken ? (
        <div>
          <span className={labelCls}>Email (verified by Google)</span>
          <div className={`rounded-xl px-3 py-2.5 text-sm font-semibold break-all ${isDarkMode ? "bg-blue-500/15 text-blue-200" : "bg-blue-50 text-blue-800"}`} data-testid="full-email">
            {google?.email ?? "…"}
          </div>
        </div>
      ) : (
        <div>
          <span className={labelCls}>Email</span>
          <EmailDomainInput localPart={localPart} onLocalPartChange={onLocalPartChange} accountType={accountType} isDarkMode={isDarkMode} />
        </div>
      )}

      {optionsError && (
        <div role="alert" className={`flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm ${isDarkMode ? "bg-red-900/30 text-red-300" : "bg-red-100 text-red-800"}`}>
          <span>{optionsError}</span>
          <button type="button" onClick={() => { setOptionsError(""); setOptionsTry((t) => t + 1); }} className="font-semibold underline">Try again</button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AuthSelect
          id="su-college" label="College" placeholder="Select college" isDarkMode={isDarkMode} loading={!options && !optionsError}
          value={collegeId} onChange={(v) => { setCollegeId(v); setDepartmentId(""); setProgrammeId(""); }}
          options={(options?.colleges ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
        />
        <AuthSelect
          id="su-department" label="Department" placeholder="Select department" isDarkMode={isDarkMode}
          value={departmentId} onChange={(v) => { setDepartmentId(v); setProgrammeId(""); }} disabled={!collegeId}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <AuthSelect
          id="su-programme" label="Programme" placeholder="Select programme" isDarkMode={isDarkMode}
          value={programmeId} onChange={setProgrammeId} disabled={!departmentId}
          options={programmes.map((p) => ({ value: p.id, label: p.name }))}
        />
        <AuthSelect
          id="su-level" label="Level" placeholder="Select level" isDarkMode={isDarkMode} loading={!options && !optionsError}
          value={level} onChange={setLevel}
          options={(options?.levels ?? []).map((l) => ({ value: String(l.value), label: l.label }))}
        />
      </div>

      <div className="min-w-0">
        <label htmlFor="su-matric" className={labelCls}>Matric number</label>
        <div className="relative">
          <Hash className={`absolute left-4 top-1/2 -translate-y-1/2 ${muted}`} size={18} />
          <input id="su-matric" type="text" value={matric} onChange={(e) => setMatric(e.target.value)} required autoCapitalize="characters" autoCorrect="off" className={`${input} pl-11`} placeholder="Matric number" />
        </div>
      </div>

      {!googleToken && (
        <div>
          <span className={labelCls}>Password</span>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" isDarkMode={isDarkMode} minLength={8} />
        </div>
      )}

      {errorBox}
      <button type="submit" disabled={busy || !options} className={primary}>
        {busy ? "Sending code…" : !options && !optionsError ? "Loading form…" : "Send verification code"}
      </button>
    </form>
  );
}
