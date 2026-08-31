// src/app/studashboard/admin/_components/AdminDomainSidebar.tsx
//
// The admin area's central navigation — one entry per platform domain, so
// this is the single overview point an admin lands in regardless of which
// domain they need. Navigation only, same as every other admin nav in this
// app: the real security boundary is requireAdmin() on each domain's own
// API calls, not this menu.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { ADMIN_DOMAINS } from "./domains";
import AdminNotificationBell from "./AdminNotificationBell";

export default function AdminDomainSidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-full sm:w-56 shrink-0 space-y-1">
      <AdminNotificationBell />
      <Link
        href="/studashboard/admin"
        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
          pathname === "/studashboard/admin" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-white"
        }`}
      >
        <LayoutGrid size={16} />
        Overview
      </Link>

      <p className="px-3.5 pt-4 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Domains</p>

      {ADMIN_DOMAINS.map((domain) => {
        const Icon = domain.icon;
        const active = pathname.startsWith(domain.href);
        return (
          <Link
            key={domain.id}
            href={domain.href}
            className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Icon size={16} />
              {domain.label}
            </span>
            {!domain.implemented && (
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${active ? "text-blue-100" : "text-gray-400"}`}>
                Soon
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
