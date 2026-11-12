// src/app/studashboard/admin/_components/DomainComingSoon.tsx
//
// The content-area placeholder for a domain listed in the sidebar/Overview
// grid that has no admin functionality yet — scoped to the content area
// (not a full-screen takeover), since DashboardNavbar + the domain sidebar
// are already rendered by ../layout.tsx. Deliberately distinct from
// src/app/components/dashboard/shared/ComingSoon.tsx, which assumes it IS
// the entire page (it renders its own sign-out control, which doesn't
// belong mid-dashboard here).

import type { LucideIcon } from "lucide-react";

export default function DomainComingSoon({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 bg-white rounded-2xl border border-gray-100">
      <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
        <Icon size={26} className="text-gray-300" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1.5">{label} admin</h1>
      <p className="text-sm text-gray-500 max-w-sm">
        There&apos;s no {label.toLowerCase()} functionality built yet, so there&apos;s nothing to administer here — check
        back once it exists.
      </p>
    </div>
  );
}
