// src/app/studashboard/marketplace/deliverer/apply/page.tsx
//
// The "Become a Deliverer" application form, reached from the marketplace
// footer. Submits to POST /api/marketplace/deliverer/apply — does NOT
// grant Delivery Dashboard access; an admin must approve it first. See
// docs/marketplace/systems/deliverer-system.md.

"use client";

import { useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { CheckCircle2, Loader2 } from "lucide-react";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";
import api from "@/lib/axios";

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function ApplyDelivererPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [status, setStatus] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      await api.post("/marketplace/deliverer/apply", form);
      setStatus("success");
    } catch (err) {
      const message = (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || "Couldn't submit your application.";
      setError(message);
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNavbar />
        <div className="pt-16 min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={28} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Application submitted</h1>
            <p className="text-sm text-gray-500 mb-8">
              An admin will review your application. You&apos;ll get access to the Delivery Dashboard once it&apos;s approved.
            </p>
            <Link href="/studashboard/marketplace" className="block w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-full transition">
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <div className="pt-16 max-w-lg mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Become a Deliverer</h1>
        <p className="text-gray-500 mb-8">Submit your details below. An admin will review and approve your application.</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="firstName">First name</label>
              <input
                id="firstName"
                required
                disabled={status === "submitting"}
                value={form.firstName}
                onChange={(e) => setForm((c) => ({ ...c, firstName: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                required
                disabled={status === "submitting"}
                value={form.lastName}
                onChange={(e) => setForm((c) => ({ ...c, lastName: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-60"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              disabled={status === "submitting"}
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="phone">
              Phone <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              disabled={status === "submitting"}
              value={form.phone}
              onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-60"
            />
          </div>

          {error && <div className="text-sm p-3 rounded-lg text-red-700 bg-red-100">{error}</div>}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-full transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === "submitting" && <Loader2 size={18} className="animate-spin" />}
            {status === "submitting" ? "Submitting…" : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
}
