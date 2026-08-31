// src/app/studashboard/admin/layout.tsx
//
// The Admin area's shell — DashboardNavbar + the domain sidebar
// (AdminDomainSidebar), shared by every admin page regardless of domain.
// This is the "central point" an admin lands in for oversight across the
// platform (see docs/admin/README.md). Layout-only, same convention as
// every other admin layout in this app: it renders no data and enforces
// nothing itself — every domain's own API calls are still gated
// server-side by requireAdmin() regardless of how this URL is reached.

import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";
import AdminDomainSidebar from "./_components/AdminDomainSidebar";

export default function AdminAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <div className="pt-16 max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-8">
        <AdminDomainSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
