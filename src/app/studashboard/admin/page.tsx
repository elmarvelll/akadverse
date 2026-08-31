// src/app/studashboard/admin/page.tsx
//
// The Admin area's landing page — one card per platform domain, styled
// like the home route's own workspace-card grid
// (src/app/studashboard/page.tsx), since this plays the same role one
// level down: "pick where you want to work." Marketplace is the only
// domain with real admin functionality today; the rest are honestly
// "Coming Soon" (see ADMIN_DOMAINS), not stubbed as if they worked.

"use client";

import { useRouter } from "next/navigation";
import { ADMIN_DOMAINS } from "./_components/domains";

export default function AdminOverviewPage() {
  const router = useRouter();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Admin</h1>
        <p className="text-gray-500">Select a domain to manage.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {ADMIN_DOMAINS.map((domain) => {
          const Icon = domain.icon;
          return (
            <div
              key={domain.id}
              onClick={() => router.push(domain.href)}
              className="relative overflow-hidden p-6 min-h-[170px] rounded-[20px] bg-white shadow-[0_2px_8px_rgba(16,24,40,0.07)] hover:shadow-[0_6px_14px_rgba(16,24,40,0.10)] transition-all cursor-pointer group"
            >
              <div className={`w-12 h-12 ${domain.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                <Icon size={24} className={domain.color} />
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition">{domain.label}</h3>
                {!domain.implemented && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{domain.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
