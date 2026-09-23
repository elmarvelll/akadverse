// src/app/studashboard/marketplace/business/[id]/layout.tsx
//
// Shell shared by every tab of a business's dashboard (page.tsx = Profile,
// products/, orders/, analytics/): the top navbar, a back link, and
// (once BusinessApprovalGate confirms the business is APPROVED) the
// BusinessSidebar. Each tab still fetches its own data client-side (see
// _components/useBusinessDetail.ts and the per-tab pages) — this layout
// itself doesn't fetch anything beyond what the gate needs, just provides
// the frame.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";
import BusinessApprovalGate from "../_components/BusinessApprovalGate";

export default async function BusinessDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <div className="pt-16 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col">
        <Link
          href="/studashboard/marketplace"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-6"
        >
          <ArrowLeft size={16} />
          Back to Marketplace
        </Link>

        <BusinessApprovalGate id={id}>{children}</BusinessApprovalGate>
      </div>
    </div>
  );
}
