// src/app/studashboard/admin/marketplace/page.tsx
//
// Admin Dashboard home — the Overview stat cards. Chrome (navbar + admin
// tab menu) comes from ./layout.tsx; every admin API call is still gated
// server-side by requireAdmin() regardless of how this URL is reached.
// See docs/marketplace/systems/admin-system.md.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { AlertCircle, Loader2, Users, Building2, Sparkles, Truck, PackageSearch, PackageCheck, Settings, ClipboardList } from "lucide-react";
import api from "@/lib/axios";

interface OverviewStats {
  userCount: number;
  businessCount: number;
  skillOwnersComingSoon: boolean;
}

const numberFormatter = new Intl.NumberFormat("en-NG");

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "forbidden" | "error">("loading");

  useEffect(() => {
    const run = async () => {
      setLoadState("loading");
      try {
        const res = await api.get<OverviewStats>("/marketplace/admin/overview");
        setStats(res.data);
        setLoadState("loaded");
      } catch (err) {
        setLoadState(isAxiosError(err) && err.response?.status === 403 ? "forbidden" : "error");
      }
    };
    run();
  }, []);

  if (loadState === "loading") {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (loadState === "forbidden" || loadState === "error") {
    return (
      <div className="flex flex-col items-center text-center py-24 px-4">
        <AlertCircle size={28} className="text-gray-400 mb-3" />
        <p className="text-gray-500">{loadState === "forbidden" ? "Admin access required." : "Couldn't load overview."}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard icon={Users} label="Users" value={numberFormatter.format(stats!.userCount)} />
        <StatCard icon={Building2} label="Businesses" value={numberFormatter.format(stats!.businessCount)} />
        <StatCard icon={Sparkles} label="Skill Owners" value="Coming Soon" muted />
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Related tools</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/studashboard/admin/marketplace/deliverers"
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:border-blue-200 transition"
        >
          <Truck size={18} className="text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">Deliverer applications</p>
            <p className="text-xs text-gray-500">Approve, reject, or suspend deliverers.</p>
          </div>
        </Link>
        <Link
          href="/studashboard/admin/marketplace/deliveries"
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:border-blue-200 transition"
        >
          <PackageSearch size={18} className="text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">Assign deliveries</p>
            <p className="text-xs text-gray-500">Delivery coordinator assignment.</p>
          </div>
        </Link>
        <Link
          href="/studashboard/admin/marketplace/dropoffs"
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:border-blue-200 transition"
        >
          <PackageCheck size={18} className="text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">Drop-offs</p>
            <p className="text-xs text-gray-500">Receive sellers waiting at the drop-off point.</p>
          </div>
        </Link>
        <Link
          href="/studashboard/admin/marketplace/settings"
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:border-blue-200 transition"
        >
          <Settings size={18} className="text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">Settings</p>
            <p className="text-xs text-gray-500">Drop-off/handoff windows and drop-off location.</p>
          </div>
        </Link>
        <Link
          href="/studashboard/admin/marketplace/deliverers/assignments"
          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:border-blue-200 transition"
        >
          <ClipboardList size={18} className="text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">Deliverer assignments</p>
            <p className="text-xs text-gray-500">See what&apos;s assigned to each deliverer, re-read pickup codes.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, muted }: { icon: typeof Users; label: string; value: string; muted?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        <Icon size={16} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${muted ? "text-gray-400" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
