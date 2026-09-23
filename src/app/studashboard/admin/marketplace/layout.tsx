// src/app/studashboard/admin/marketplace/layout.tsx
//
// Second-level chrome, nested inside ../layout.tsx (which owns
// DashboardNavbar + the domain sidebar): just the Marketplace admin tab
// menu, once, instead of duplicated per page. Layout-only — every page
// underneath still gates its own API calls with requireAdmin() server-side;
// this file renders no data and enforces nothing by itself.

import AdminMainMenu from "./_components/AdminMainMenu";

export default function MarketplaceAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminMainMenu />
      {children}
    </div>
  );
}
