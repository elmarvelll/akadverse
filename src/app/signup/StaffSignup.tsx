// src/app/signup/StaffSignup.tsx
//
// Faculty / HOD / DAPU sign-up: details -> emailed 6-digit OTP to that exact address -> account created -> signed in.
// Same verification as students (services/auth/signup-otp). Faculty and HOD also pick a College and Department (DAPU is
// university-wide). Choosing a role here never grants it — see services/auth/staff-signup/staff-role.ts.

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { PasswordInput } from "../components/password-input";
import { EmailDomainInput } from "../components/email-domain-input";
import { AuthSelect } from "../components/auth-select";
import { SignupOtpStep } from "./SignupOtpStep";
import type { AccountTypeRole } from "@/lib/account-domains";

const messageOf = (err: unknown, fallback: string) => (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || fallback;

export function StaffSignup({
  isDarkMode,
  localPart,
  onLocalPartChange,
  accountType,
}: {
  isDarkMode: boolean;
  localPart: string;
  onLocalPartChange: (v: string) => void;
  accountType: Exclude<AccountTypeRole, "student">;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", password: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ id: string; email: string; cooldown: number } | null>(null);

  // Faculty and HOD also choose a College and Department (dropdowns from the E-Learning database).
  const needsDepartment = accountType === "faculty" || accountType === "hod";
  const [orgOptions, setOrgOptions] = useState<{ colleges: { id: string; code: string; name: string }[]; departments: { id: string; collegeId: string; name: string }[] } | null>(null);
  const [collegeId, setCollegeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  useEffect(() => {
    if (!needsDepartment || orgOptions) return;
    api.get("/signup/student/options").then((r) => setOrgOptions({ colleges: r.data.colleges, departments: r.data.departments })).catch(() => setError("Couldn't load the college and department options. Please refresh."));
  }, [needsDepartment, orgOptions]);
  const departmentsOfCollege = useMemo(() => orgOptions?.departments.filter((d) => d.collegeId === collegeId) ?? [], [orgOptions, collegeId]);

  const updateField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: e.target.value }));

  const sendDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/signup/staff/start", { ...form, accountType, localPart, ...(needsDepartment ? { collegeId, departmentId } : {}) });
      setPending({ id: data.pendingId, email: data.email, cooldown: data.resendAfterSeconds });
    } catch (err) {
      setError(messageOf(err, "Couldn't start sign-up. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  // The account now exists: start a normal session.
  const afterVerified = async () => {
    if (!pending) return;
    const res = await signIn("credentials", { email: pending.email, password: form.password, redirect: false });
    router.push(res?.error ? "/login" : "/");
  };

  if (pending) {
    return (
      <SignupOtpStep
        key={pending.id}
        isDarkMode={isDarkMode}
        email={pending.email}
        pendingId={pending.id}
        initialCooldown={pending.cooldown}
        verifyPath="/signup/staff/verify"
        resendPath="/signup/staff/resend"
        onVerified={afterVerified}
        onBack={() => { setPending(null); setError(""); }}
      />
    );
  }

  const fieldCls = `w-full px-4 py-3 border rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-base sm:text-sm ${
    isDarkMode ? "bg-[#171717] border-[#262626] text-white placeholder-[#a3a3a3]" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
  }`;
  return (
    <form onSubmit={sendDetails} className="space-y-4" data-testid="staff-form">
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
        <EmailDomainInput localPart={localPart} onLocalPartChange={onLocalPartChange} accountType={accountType} isDarkMode={isDarkMode} />
      </div>
      <PasswordInput value={form.password} onChange={updateField("password")} placeholder="Password (at least 8 characters)" isDarkMode={isDarkMode} minLength={8} />
      {error && <div role="alert" className={`text-sm p-3 rounded-lg ${isDarkMode ? "text-red-300 bg-red-900/30" : "text-red-800 bg-red-100"}`}>{error}</div>}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {busy ? "Sending code…" : "Send verification code"}
      </button>
    </form>
  );
}
