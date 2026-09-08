// src/app/studashboard/marketplace/vendor-dashboard/[id]/layout.tsx
//
// Shell shared by every tab of a vendor's OWN dashboard (page.tsx =
// Profile+capacity, products/, sides/, orders/): the top navbar, a back
// link, and (once VendorApprovalGate confirms the vendor is APPROVED) the
// VendorSidebar. Deliberately its own route tree, not nested under
// business/[id] — Vendor is a structurally independent feature (spec §1,
// §14; see
// docs/marketplace/decisions/vendor-independent-architecture.md), not a
// conditional inside the Business dashboard. The public storefront lives
// separately at studashboard/marketplace/vendor/[id] and is untouched.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";
import VendorApprovalGate from "../_components/VendorApprovalGate";

export default async function VendorDashboardLayout({
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

        <VendorApprovalGate id={id}>{children}</VendorApprovalGate>
      </div>
    </div>
  );
}
