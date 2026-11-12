// src/app/signup/SignupOtpStep.tsx
//
// Step 2 of every sign-up (Student, Faculty, HOD, DAPU): enter the 6-digit code emailed to the address being signed up,
// with resend (countdown while the cooldown runs) and a way back to the details. `onVerified` runs once the server has
// accepted the code and created the account (the caller then signs the person in).

"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { OtpInput } from "../components/otp-input";

const messageOf = (err: unknown, fallback: string) => (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || fallback;

export function SignupOtpStep({
  isDarkMode,
  email,
  pendingId,
  initialCooldown,
  verifyPath,
  resendPath,
  onVerified,
  onBack,
  notice,
}: {
  isDarkMode: boolean;
  email: string;
  pendingId: string;
  initialCooldown: number;
  verifyPath: string;
  resendPath: string;
  onVerified: () => Promise<void>;
  onBack: () => void;
  notice?: React.ReactNode;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [resending, setResending] = useState(false);

  // Resend countdown (ticks only while a cooldown is running).
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // ignore a second submit while one is running
    setBusy(true);
    setError("");
    try {
      await api.post(verifyPath, { pendingId, code });
    } catch (err) {
      setError(messageOf(err, "Couldn't verify the code. Please try again."));
      setBusy(false);
      return;
    }
    await onVerified();
  };

  const resend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    setError("");
    try {
      const { data } = await api.post(resendPath, { pendingId });
      setCooldown(data.resendAfterSeconds);
      setCode("");
    } catch (err) {
      setError(messageOf(err, "Couldn't send a new code."));
    } finally {
      setResending(false);
    }
  };

  const muted = isDarkMode ? "text-[#a3a3a3]" : "text-gray-600";
  return (
    <form onSubmit={verify} className="space-y-4" data-testid="otp-step">
      <p className={`text-sm ${muted}`}>
        We sent a 6-digit code to <strong className={`break-all ${isDarkMode ? "text-white" : "text-gray-900"}`}>{email}</strong>. Enter it below to finish creating your account.
      </p>
      {notice}
      <OtpInput value={code} onChange={setCode} isDarkMode={isDarkMode} disabled={busy} />
      {error && <div role="alert" className={`text-sm p-3 rounded-lg ${isDarkMode ? "text-red-300 bg-red-900/30" : "text-red-800 bg-red-100"}`}>{error}</div>}
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {busy ? "Verifying…" : "Verify and create account"}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={resend} disabled={cooldown > 0 || busy || resending} aria-busy={resending} className={`font-semibold underline disabled:no-underline disabled:opacity-60 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          {resending ? "Sending a new code…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        <button type="button" disabled={busy || resending} onClick={onBack} className={`underline ${muted}`}>
          Change my details
        </button>
      </div>
    </form>
  );
}
