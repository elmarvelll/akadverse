// src/app/admin/_components/AdminMainMenu.tsx
//
// The admin-only equivalent of a normal nav menu — every tab here is
// server-side gated by requireAdmin() on its own API calls regardless of
// how the URL is reached; this menu is navigation only, never the
// security boundary. See docs/marketplace/systems/admin-system.md.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/studashboard/admin/marketplace", label: "Overview" },
  { href: "/studashboard/admin/marketplace/users", label: "Users" },
  { href: "/studashboard/admin/marketplace/verifications", label: "Verifications" },
  { href: "/studashboard/admin/marketplace/disputes", label: "Disputes" },
  { href: "/studashboard/admin/marketplace/events", label: "Events" },
  { href: "/studashboard/admin/marketplace/fines", label: "Fines" },
  { href: "/studashboard/admin/marketplace/businesses", label: "Businesses" },
  { href: "/studashboard/admin/marketplace/products", label: "Products" },
  { href: "/studashboard/admin/marketplace/reports", label: "Reports" },
  { href: "/studashboard/admin/marketplace/deliveries", label: "Deliveries" },
];

export default function AdminMainMenu() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-6">
      {TABS.map((tab) => {
        // Overview's own href ("/studashboard/admin/marketplace") must only match exactly — every
        // other tab's href is also a prefix of its own nested/dynamic
        // routes (e.g. a future /admin/businesses/[id]), so those match on
        // startsWith.
        const active = tab.label === "Overview" ? pathname === tab.href : pathname.startsWith(tab.href) || (tab.label === "Deliveries" && ["/studashboard/admin/marketplace/delivery-roster", "/studashboard/admin/marketplace/vendor-delivery", "/studashboard/admin/marketplace/delivery-operations", "/studashboard/admin/marketplace/deliverers", "/studashboard/admin/marketplace/dropoffs"].some((prefix) => pathname.startsWith(prefix)));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
              active ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
