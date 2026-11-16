"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import type { getDeliveryOverview, DeliveryMetrics } from "@/services/marketplace/delivery-roster/delivery-overview";

type Overview = Awaited<ReturnType<typeof getDeliveryOverview>>;
const LABELS: [keyof DeliveryMetrics, string][] = [
  ["total", "Total scheduled"], ["today", "Scheduled today"], ["upcoming", "Upcoming"],
  ["pending", "Pending completion"], ["completed", "Completed"], ["overdue", "Overdue"],
  ["rosteredPersonnel", "Rostered personnel"], ["fullyOccupiedSlots", "Full slots (next 7 days)"], ["overflow", "Overflow"],
];

export default function DeliveriesOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.get<{ overview: Overview }>("/marketplace/admin/deliveries/overview");
        if (active) { setOverview(res.data.overview); setError(false); }
      } catch { if (active) setError(true); }
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return <div>
    <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
    <p className="mt-1 mb-6 text-sm text-gray-600">Manage Business and Vendor deliveries, rosters, capacity and personnel.</p>
    <div className="mb-5 flex flex-wrap gap-3 text-sm text-blue-700">
      <Link href="/studashboard/admin/marketplace/deliveries/assign" className="underline">Assign ready deliveries</Link>
      <Link href="/studashboard/admin/marketplace/deliverers" className="underline">Manage personnel</Link>
      <Link href="/studashboard/admin/marketplace/deliverers/assignments" className="underline">Assigned deliveries</Link>
      <Link href="/studashboard/admin/marketplace/dropoffs" className="underline">Business drop-offs</Link>
    </div>
    {error && <p role="alert" className="mb-4 text-red-700">Could not refresh delivery statistics. Retrying automatically.</p>}
    {!overview && !error && <p role="status" className="text-gray-600">Loading delivery statistics…</p>}
    {overview && <>
      <p className="mb-4 text-sm text-gray-600">{overview.today} · {overview.timezone} · {overview.approvedPersonnel} approved personnel available to roster.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        {([["business", "Businesses", "businesses"], ["vendor", "Vendors", "vendors"]] as const).map(([key, title, slug]) => <section key={key} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900"><Link href={`/studashboard/admin/marketplace/deliveries/${slug}`} className="text-blue-700 hover:underline">{title} →</Link></h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">{LABELS.map(([metric, label]) => <div key={metric}><dt className="text-xs text-gray-600">{label}</dt><dd className="mt-1 text-xl font-bold text-gray-900">{overview[key][metric]}</dd></div>)}</dl>
        </section>)}
      </div>
      <p className="mt-4 text-xs text-gray-500">Delivery counts include paid live orders and completed deliveries. Vendor checkouts count once across vendors. Full-slot counts include active payment reservations for each weekday’s next occurrence. Overdue means an incomplete delivery past its window end.</p>
    </>}
  </div>;
}
